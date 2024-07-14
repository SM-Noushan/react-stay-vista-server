require("dotenv").config();
const cors = require("cors");
const express = require("express");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 8000;

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
// middleware
const app = express();
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// send automated mail
const sendEmail = (emailAddress, emailData) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.TRANSPORTER_USER,
      pass: process.env.TRANSPORTER_PASSWORD,
    },
  });

  // verify connection configuration
  transporter.verify(function (error, success) {
    if (error) console.log(error);
    // else console.log("Server is ready to take our messages");
  });

  const mailBody = {
    from: `"StayVista" <${process.env.TRANSPORTER_USER}>`, // sender address
    to: emailAddress, // list of receivers
    subject: emailData.subject, // Subject line
    html: emailData.message, // html body
  };

  transporter.sendMail(mailBody, (err, info) => {
    if (err) console.log(err);
    // else console.log("Email Sent" + info.response);
  });
};

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      // console.log(err);
      return res.status(401).send({ message: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.b6wqjn1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("stayVista");
    const roomCollection = db.collection("rooms");
    const userCollection = db.collection("users");
    const bookingCollection = db.collection("bookings");

    // Middleware
    // Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await userCollection.findOne(query);
      if (!result || result?.role !== "admin")
        return res.status(403).send({ message: "Forbidden Access" });
      next();
    };

    // Verify Admin
    const verifyHost = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await userCollection.findOne(query);
      if (!result || result?.role !== "host")
        return res.status(403).send({ message: "Forbidden Access" });
      next();
    };

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        // console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // user related api

    // save user data in db
    app.put("/user", async (req, res) => {
      const user = req.body;
      const options = { upsert: true };
      const query = { email: user?.email };
      let updateDoc = {};
      if (user?.status.toLowerCase() === "requested")
        // update user status to requested
        updateDoc = {
          $set: {
            status: user?.status,
          },
        };
      // insert only if its a new user
      else
        updateDoc = {
          $setOnInsert: {
            ...user,
            timestamp: Date.now(),
          },
        };
      const result = await userCollection.updateOne(query, updateDoc, options);
      if (result.upsertedCount)
        sendEmail(user?.email, {
          subject: "<No-Reply> Welcome To StayVista",
          message: `Browse Rooms and Reserve Now! Hope you find your destination here.`,
        });
      res.send(result);
    });

    // get specific user info by email
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });

    // get all users info
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // update user role
    app.patch("/user/update/role/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const updatedDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await userCollection.updateOne({ email }, updatedDoc);
      res.send(result);
    });

    // rooms related api

    // get all room
    app.get("/rooms", async (req, res) => {
      const category = req.query.category;
      let query = {};
      if (category && category !== "null") query = { category };
      const result = await roomCollection.find(query).toArray();
      res.send(result);
    });

    // get a single room data using _id
    app.get("/room/:id", async (req, res) => {
      const id = req.params.id;
      const result = await roomCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // get all room for host
    app.get(
      "/my-listings/:email",
      verifyToken,
      verifyHost,
      async (req, res) => {
        const email = req.params.email;
        const result = await roomCollection
          .find({ "host.email": email })
          .toArray();
        res.send(result);
      }
    );

    // get all bookings for host
    app.get(
      "/manage-bookings/:email",
      verifyToken,
      verifyHost,
      async (req, res) => {
        const email = req.params.email;
        const result = await bookingCollection
          .find({ "host.email": email })
          .toArray();
        res.send(result);
      }
    );

    // get all bookings for guest
    app.get("/my-bookings/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await bookingCollection
        .find({ "guest.email": email })
        .toArray();
      res.send(result);
    });

    // save new room data
    app.post("/room", verifyToken, verifyHost, async (req, res) => {
      const roomData = req.body;
      const result = await roomCollection.insertOne(roomData);
      res.send(result);
    });

    // update room details
    app.patch("/room/:id", verifyToken, verifyHost, async (req, res) => {
      const id = req.params.id;
      const roomData = req.body;
      // update room status
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: roomData,
      };
      const result = await roomCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // change room status
    app.patch("/room/status/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      // update room status
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          booked: status,
        },
      };
      const result = await roomCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // remove host room data
    app.delete("/room/:id", verifyToken, verifyHost, async (req, res) => {
      const id = req.params.id;
      const result = await roomCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // remove guest booking
    app.delete("/booking/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // stripe payment intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const priceInCent = parseFloat(price * 100);
      if (!price || priceInCent < 1) return;

      // generate client secret
      // Create a PaymentIntent with the order amount and currency
      const { client_secret } = await stripe.paymentIntents.create({
        amount: priceInCent,
        currency: "usd",
        payment_method_types: ["card"],
      });

      // send client secret as response
      res.send({
        clientSecret: client_secret,
      });
    });

    // save booking data
    app.post("/booking", verifyToken, async (req, res) => {
      const bookingData = req.body;
      bookingData.roomId = new ObjectId(bookingData?.roomId);
      // save new booking info
      const result = await bookingCollection.insertOne(bookingData);
      // send email to host
      sendEmail(bookingData?.host?.email, {
        subject: "<No-Reply> Your Room Got Reserved",
        message: `Get Ready To Welcome ${bookingData?.guest.name}`,
      });
      // send email to guest
      sendEmail(bookingData?.guest?.email, {
        subject: "<No-Reply> Reservation Successful",
        message: `You've successfully reserved a room through StayVista. TransactionId: ${bookingData?.transactionId}`,
      });
      res.send(result);
    });

    // statistics related api

    // admin stats
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const totalUsers = await userCollection.countDocuments();
      const totalRooms = await roomCollection.countDocuments();
      const bookingDetails = await bookingCollection
        .find(
          {},
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray();
      const totalSales = bookingDetails.reduce(
        (acc, booking) => acc + booking.price,
        0
      );
      // summing up same day sale
      const aggregatedData = bookingDetails.reduce((acc, booking) => {
        const date = new Date(booking.date.split("T")[0]);
        if (!acc[date]) {
          acc[date] = 0;
        }

        acc[date] += booking.price;
        return acc;
      }, {});
      // converting to chart data
      const chartData = Object.entries(aggregatedData).map(([date, price]) => {
        const day = new Date(date).getDate();
        const month = new Date(date).getMonth() + 1;
        const data = [`${day}/${month}`, price];
        return data;
      });
      chartData.unshift(["Day", "Sales"]);
      res.send({
        totalSales,
        totalUsers,
        totalBookings: bookingDetails.length,
        totalRooms,
        chartData,
      });
    });

    // host stats
    app.get("/host-stats", verifyToken, verifyHost, async (req, res) => {
      const { email } = req.user;
      const { timestamp } = await userCollection.findOne(
        { email },
        {
          projection: {
            timestamp: 1,
          },
        }
      );
      const totalRooms = await roomCollection.countDocuments({
        "host.email": email,
      });
      const bookingDetails = await bookingCollection
        .find(
          { "host.email": email },
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray();
      const totalSales = bookingDetails.reduce(
        (acc, booking) => acc + booking.price,
        0
      );
      // summing up same day sale
      const aggregatedData = bookingDetails.reduce((acc, booking) => {
        const date = new Date(booking.date.split("T")[0]);
        if (!acc[date]) {
          acc[date] = 0;
        }

        acc[date] += booking.price;
        return acc;
      }, {});
      // converting to chart data
      const chartData = Object.entries(aggregatedData).map(([date, price]) => {
        const day = new Date(date).getDate();
        const month = new Date(date).getMonth() + 1;
        const data = [`${day}/${month}`, price];
        return data;
      });
      chartData.unshift(["Day", "Sales"]);
      res.send({
        totalSales,
        totalBookings: bookingDetails.length,
        totalRooms,
        hostSince: timestamp,
        chartData,
      });
    });

    // guest stats
    app.get("/guest-stats", verifyToken, async (req, res) => {
      const { email } = req.user;
      const { timestamp } = await userCollection.findOne(
        { email },
        {
          projection: {
            timestamp: 1,
          },
        }
      );
      const bookingDetails = await bookingCollection
        .find(
          { "guest.email": email },
          {
            projection: {
              date: 1,
              price: 1,
            },
          }
        )
        .toArray();
      const totalSpent = bookingDetails.reduce(
        (acc, booking) => acc + booking.price,
        0
      );
      // summing up same day expense
      const aggregatedData = bookingDetails.reduce((acc, booking) => {
        const date = new Date(booking.date.split("T")[0]);
        if (!acc[date]) {
          acc[date] = 0;
        }

        acc[date] += booking.price;
        return acc;
      }, {});
      // converting to chart data
      const chartData = Object.entries(aggregatedData).map(([date, price]) => {
        const day = new Date(date).getDate();
        const month = new Date(date).getMonth() + 1;
        const data = [`${day}/${month}`, price];
        return data;
      });
      chartData.unshift(["Day", "Spent"]);
      res.send({
        totalSpent,
        totalBookings: bookingDetails.length,
        guestSince: timestamp,
        chartData,
      });
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

app.get("/", (req, res) => {
  res.send("Hello from StayVista Server..");
});

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`);
});
