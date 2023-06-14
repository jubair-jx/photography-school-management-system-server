const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const PORT = process.env.PORT || 4000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

//middleware setup
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Bruuh Your Server is Running Here!!!!!");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.udnr6tc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//verify JWT middle ware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "UnAuthorized Access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "UnAuthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    const userCollection = client.db("wonder-db").collection("users");
    const classCollection = client.db("wonder-db").collection("class");
    const paymentCollection = client.db("wonder-db").collection("payment");
    const feedbackCollection = client.db("wonder-db").collection("feedback");
    const SelectClassCollection = client
      .db("wonder-db")
      .collection("select-class");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });
    //verify admin function
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };
    //verify instructor function
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };
    //verify student function
    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "student") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };
    //selectClass RelatedAPi
    app.post("/selectClass", verifyJWT, async (req, res) => {
      const body = req.body;
      const result = await SelectClassCollection.insertOne(body);
      res.send(result);
    });
    //select Class get API
    app.get("/selectedClass", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await SelectClassCollection.find(query).toArray();
      res.send(result);
    });
    //select delete api
    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await SelectClassCollection.deleteOne(query);
      res.send(result);
    });

    //user Related Api
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/feedback", verifyJWT, async (req, res) => {
      //   const id = req.params.id;
      //   const query = { _id: new ObjectId(id) };
      const result = await feedbackCollection.find().toArray();
      res.send(result);
    });

    app.post("/feedback", async (req, res) => {
      const body = req.body;
      console.log(body);
      const result = await feedbackCollection.insertOne(body);
      res.send(result);
    });

    //admin api
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.get("/users/admin/check/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    //instructor api
    app.get("/users/instructor/check/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });
    //student related get api
    app.get("/users/student/check/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ student: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { student: user?.role === "student" };
      res.send(result);
    });

    //get api for instructor
    app.get("/users/instructor", async (req, res) => {
      const result = await userCollection
        .find({ role: "instructor" })
        .toArray();
      res.send(result);
    });

    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // post all users api when create a new user on website
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "student";
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User is Alrady Exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //class related apis
    app.post("/class", verifyJWT, verifyInstructor, async (req, res) => {
      const newItem = req.body;
      const result = await classCollection.insertOne(newItem);
      res.send(result);
    });
    //class get api
    app.get("/class", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    //This email is check when this user login then he/she was added items
    app.get(
      "/class/instructor/:email",
      verifyJWT,

      async (req, res) => {
        const email = req.params.email;
        const result = await classCollection.find({ email: email }).toArray();
        res.send(result);
      }
    );
    app.patch("/class/approved/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateClass = req.body;
      const updateDoc = {
        $set: {
          status: updateClass.status,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/class/deny/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateClass = req.body;
      const updateDoc = {
        $set: {
          status: updateClass.status,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //payment-intent api

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      if (price <= 0) {
        return res.send({});
      }
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //payment details post api
    app.post("/payment", async (req, res) => {
      const body = req.body;
      console.log(body);
      const InsertResult = await paymentCollection.insertOne(body);

      const query = {
        _id: { $in: body.classId.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await classCollection.deleteMany(query);
      res.send({ InsertResult, deleteResult });
    });
    //payment history api
    app.get("/payment", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.listen(PORT, () => {
  console.log(`Your Server is Running on PORT : ${PORT}`);
});
