const express = require("express");
const app = express();
const path = require("path");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const xss = require('xss-clean');
const { rateLimit } = require("express-rate-limit");
const helmet = require('helmet');
const PORT = process.env.PORT || 3000;
const courses = require("./data/courses.js");

//middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["https://pf202.vercel.app", "http://127.0.0.1:5500"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  })
);
//rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
app.use(limiter);
app.use(helmet());
app.use(xss());

//view endpoint
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "/views/index.html"));
});

//is auth middleware
// const isAuth = true;
// const isAuthMiddleware = (_, res, next) => {
//   if (isAuth) {
//     next();
//   } else {
//     res.status(401).json({
//       message: "unauthorized",
//     });
//   }
// };
//secret key middleware
const secretKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers["api-key"];
  if (!apiKey) {
    res.status(401).json({
      message: "no API KEY provided",
    });
  } else {
    if (apiKey === process.env.SECRET_KEY) {
      next();
    } else {
      res.status(401).json({
        message: "invalid API KEY",
      });
    }
  }
};

// app.use((_, res, next) => {
//   if (isAuth) {
//     next();
//   } else {
//     res.status(401).json({
//       message: "unauthorized",
//     });
//   }
// });

// courses CRUD - get all, get by name, get by id, post, put, patch, delete
//search, sort, pagination, error handling

app.get("/courses", secretKeyMiddleware, (req, res) => {
  try {
    const { search = "", sort, page = 1, limit = 3 } = req.query;

    const searchedCourses = courses
      .filter((c) => {
        return (
          c.name.toLowerCase().trim().includes(search.toLowerCase().trim()) ||
          c.description
            .toLowerCase()
            .trim()
            .includes(search.toLowerCase().trim())
        );
      })
      .slice(page * limit - limit, page * limit);

    //sort
    if (sort) {
      const [key, sorter] = sort.split("-");

      const sortedCourses = searchedCourses.sort((course1, course2) => {
        switch (sorter) {
          case "asc":
            return course1[key] > course2[key] ? 1 : -1;
          case "desc":
            return course1[key] > course2[key] ? -1 : 1;
        }
      });

      res.status(200).json({
        message: "success",
        data: sortedCourses,
      });
    }

    res.status(200).json({
      message: "success",
      total: courses.length,
      hasMore: Boolean(courses.length - page * limit > 0),
      data: searchedCourses,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "fail",
    });
  }
});

app.get("/courses/name/:name", (req, res) => {
  try {
    const { name } = req.params;

    const course = courses.find(
      (c) => c.name.toLowerCase().trim() === name.toLowerCase().trim()
    );

    if (course) {
      res.status(200).json({
        message: "success",
        data: course,
      });
    } else {
      res.json({
        message: "not found",
        data: null,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: error.message || "fail",
    });
  }
});

app.get("/courses/:id", (req, res) => {
  try {
    const { id } = req.params;
    const course = courses.find((c) => c.id == id);
    if (course) {
      res.status(200).json({
        message: "success",
        data: course,
      });
    } else {
      res.json({
        message: "not found",
        data: null,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: error.message || "fail",
    });
  }
});

//POST, PUT/PATCH, DELETE
app.delete("/courses/:id", (req, res) => {
  try {
    const { id } = req.params;
    const courseIdx = courses.findIndex((c) => c.id == id);
    if (courseIdx === -1) {
      res.status(404).json({
        message: "not found",
      });
    } else {
      courses.splice(courseIdx, 1);
      res.status(200).json({
        message: "deleted",
        data: courses,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: error.message || "fail",
    });
  }
});

app.post("/courses", (req, res) => {
  try {
    const { name, price, description, duration } = req.body;

    //simple custom validation
    if (!name || !price || !description || !duration) {
      res.status(403).json({
        message: "invalid data format",
      });
    } else {
      const newCourse = {
        id: +courses[courses.length - 1].id + 1,
        name,
        price,
        description,
        duration,
      };

      courses.push(newCourse);

      res.json({
        status: "posted",
        data: newCourse,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: error.message || "fail",
    });
  }
});

//put vs patch
app.put("/courses/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description, duration } = req.body;
    const idx = courses.findIndex((c) => c.id == id);

    if (idx === -1) {
      res.status(404).json({
        message: "not found",
      });
    } else {
      const updatedCourse = {
        id,
      };
      if (name) updatedCourse.name = name;
      if (price) updatedCourse.price = price;
      if (description) updatedCourse.description = description;
      if (duration) updatedCourse.duration = duration;
      courses.splice(idx, 1, updatedCourse);
      res.status(200).json({
        message: "updated",
        data: updatedCourse,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: error.message || "fail",
    });
  }
});

app.patch("/courses/:id", (req, res) => {
  const { id } = req.params;
  const { name, price, description, duration } = req.body;
  const course = courses.find((c) => c.id == id);
  if (course) {
    //update
    if (name) course.name = name;
    if (price) course.price = price;
    if (description) course.description = description;
    if (duration) course.duration = duration;

    res.status(200).json({
      message: "partial update complete",
      data: course,
    });
  } else {
    res.status(404).json({
      message: "not found with given ID",
    });
  }
});

app.listen(PORT, () => {
  console.log(`server running on port: ${PORT}`);
});
