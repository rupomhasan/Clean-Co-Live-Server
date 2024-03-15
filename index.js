const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
var cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
var cookieParser = require("cookie-parser");

const port = 5000;

//parser
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Mongo uri
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.r44bh6t.mongodb.net/Clean-co?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const gateman = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send({ message: "UnAuthorized Access1" });
  }
  jwt.verify(token, process.env.SECRET, (err, decode) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "UnAuthorized access2" });
    }
    req.user = decode;
    next();
  });
};

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // auth
    app.post("/api/v1/auth/access-token", async (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign({ user }, process.env.SECRET, {
        expiresIn: "100h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: "none",
          secure: false,
        })
        .send({ success: true });
    });

    const serviceCollection = client.db("CleanC0").collection("services");
    const bookingCollection = client.db("CleanC0").collection("booking");

    app.get("/", async (req, res) => {
      res.send("connection is running");
    });

    // get all data
    //http://localhost:5000/api/v1/services

    //get data by category(any key)
    // http://localhost:5000/api/v1/services?category=Home Cleaning

    // get data by sort
    //http://localhost:5000/api/v1/services?sortField=price&sortOrder=desc

    // Pagination
    //http://localhost:5000/api/v1/services?page=1&limit=5 //

    app.get("/api/v1/services", gateman, async (req, res) => {
      let queryObj = {};
      let sortObj = {};
      //Sort
      const sortOrder = req.query.sortOrder;
      const sortField = req.query.sortField;
      //find by key
      const category = req.query.category;

      //Pagination
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const skip = (page - 1) * limit;
      //condition
      if (category) {
        queryObj.category = category;
      }
      if (sortOrder && sortField) {
        sortObj[sortField] = sortOrder;
      }

      const result = await serviceCollection
        .find(queryObj)
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .toArray();
      const total = await serviceCollection.countDocuments();
      res.send({ total, result });
    });

    app.get("/api/v1/user/bookings", gateman, async (req, res) => {
      console.log(req.user);
      const queryEmail = req.query.email;
      const tokenEmail = req.user.email;
      if (queryEmail !== tokenEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (queryEmail) {
        query.email = queryEmail;
      }

      const result = await bookingCollection.findOne(query).toArray();
      res.send(result);
    });

    app.post("/api/v1/user/create-booking", async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });
    app.delete("/api/v1/user/cancel-booking/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const query = { _id: new ObjectId(id) };
        const result = await bookingCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.log(err);
      }
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
