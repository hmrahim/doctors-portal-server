const express = require("express");
const app = express();
const cors = require("cors");
const mongodb = require("mongodb").ObjectId
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { status } = require("express/lib/response");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.trq2z.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
const run = async () => {
  try {
    client.connect();
    console.log("Database connected succesfully");

    const serviceCollection = client
      .db("doctors-portal")
      .collection("services");
    const bookingCollection = client
      .db("doctors-portal")
      .collection("bookings");
    const usersCollection = client
      .db("doctors-portal")
      .collection("users");
    const doctorsCollection = client
      .db("doctors-portal")
      .collection("doctors");
    const paymentCollection = client
      .db("doctors-portal")
      .collection("payment");

      
      const verifyAdmin = async(req,res,next)=> {
        const requester = req.decoded.email
        const requesterData = await usersCollection.findOne({email:requester})
        if(requesterData.role === "Admin"){
        next()
        }else{
          res.status(403).send("unAuthorize access")
        }
  
      }

    app.get("/services", async (req, res) => {
      const data = serviceCollection.find({}).project({name:1});
      const services = await data.toArray();
      res.send(services);
    });

    app.put("/user/:email",async(req,res)=> {
      const email = req.params.email
      const obj = req.body
      console.log(obj);
      const filter = {email:email}
      const options = { upsert: true };
      console.log(email);
      const docs = {
        $set:obj
      }

      const result = await usersCollection.updateOne(filter,docs,options)
      const token = jwt.sign({email:email}, process.env.SECRET);
      console.log(token);
      res.send({result,token})
      

    })




    app.put("/user/makeadmin/:email",verify,verifyAdmin,async(req,res)=> {
      const email = req.params.email
      const requester = req.decoded.email
      const filter = {email:email}
      console.log("email",requester);
      const docs = {
        $set:{role:"Admin"}
      }
      const requesterData = await usersCollection.findOne({email:requester})
      const result = await usersCollection.updateOne(filter,docs)
  
    

    })

    app.get("/admin/:email",async (req,res)=> {
      const email = req.params.email
      const result = await usersCollection.findOne({email:email})
      const isAdmin = result.role === "Admin"
      console.log(isAdmin);
      res.send({admin:isAdmin})
    })

    app.get("/user",verify,async (req,res)=> {
      const data =await usersCollection.find().toArray()
      res.send(data)
    })

    app.post("/booking", async (req, res) => {
      const data = req.body;
      const query = { name: data.name, email: data.email, date: data.data };
      const exist = await bookingCollection.findOne({
        email: data.email,
        date: data.date,
        name: data.name,
      });

      if (exist) {
        return res.send({ success: false, data: exist });
      } else {
        const result = await bookingCollection.insertOne(data);
        return res.send({ success: true, data: result });
      }
    });

    app.get("/availableslots", async (req, res) => {
      const date = req.query.date;
      const services = await serviceCollection.find().toArray();
      //res.send(services)

      const bookings = await bookingCollection.find({ date: date }).toArray();
      services.forEach((service) => {
        const serviceBooking = bookings.filter(
          (book) => book.name === service.name
        );

        const bookedSlot = serviceBooking.map((book) => book.slot);
        const available = service.slots.filter(
          (slot) => !bookedSlot.includes(slot)
        );
        service.slots = available;
      });

      res.send(services);
    });

    app.get("/bookings",verify, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const token = req.headers.authorization
      const decodedEmail= req.decoded.email
      if(email === decodedEmail){
        const resutl = await bookingCollection.find(query).toArray();
      res.send(resutl);

      }else{
        return res.status(403).send("forbidden access")
      }

      
    });

    app.get("/bookings/:id",verify,async (req,res)=> {
      const id = req.params.id
      const data = await bookingCollection.findOne({_id:ObjectId(id)})
      res.send(data)

    })

    app.patch("/booking/:id",async(req,res)=>{
      const id = req.params.id
      const query = {_id:ObjectId(id)}
      const body = req.body
      const docs = {
        $set:{
          paid:true,
          transactionId:body.transactionId
        }
      }

      const result = await bookingCollection.updateOne(query,docs)
      const insertedData = await paymentCollection.insertOne(body)

      res.send(result,)
    })

    app.post("/doctors",verify,verifyAdmin,async(req,res)=> {
      const data = req.body
      const result = await doctorsCollection.insertOne(data)
      res.send(data)


    })

    app.get("/doctors",verify,async(req,res)=> {
      const data = await doctorsCollection.find().toArray()
      res.send(data)


    })
    app.delete("/doctors/:email",async(req,res)=> {
      const email = req.params.email
      const result =await doctorsCollection.deleteOne({email:email})
      res.send(result)


    })



    //payment intent..........................
    app.post("/create-payment-intent", async (req, res) => {
      const  price  = req.body.price;
      const newPrice = parseInt(req.body.price)
      const amount = newPrice * 100
    
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types:["card"]
      });
    
      console.log("price",newPrice);
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    }); 









  } finally {
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("from home page");
});

app.listen(port, () => {
  console.log("server started on port 5000");
});



function verify(req,res,next){
  const header = req.headers.authorization

  
  // jwt.verify(token, process.env.SECRET, function(err, decoded) {
  //   console.log(decoded.email) // bar
  // });
  if(!header){
    return res.status(401).send("unAuthorize access")
  }
  const token = header.split(" ")[1]
   jwt.verify(token, process.env.SECRET, function(err, decoded) {
    if(err){
      return res.status(403).send("forbidden access")
    }
    req.decoded = decoded

    next()
  });
 
  

  

}