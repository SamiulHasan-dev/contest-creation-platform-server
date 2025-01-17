const express = require('express');
const app = express();
const cors = require('cors');
var jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qdflpzq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("contestDB").collection("users");
    const contestCollection = client.db("contestDB").collection("contests");
    const paymentCollection = client.db("contestDB").collection("payments");

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })


    //middleware
    const verifyToken = (req, res, next) => {
      console.log('inside verify tokens', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    //use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }


    //USER related api
    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesn't exists
      // you can do this many ways (1. email unique, 2. upsert and 3. simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.get('/users', verifyToken, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.delete('/usersDelete/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/usersUser/:email', async (req, res) => {
      const myEmail = req.params.email;
      const query = { email: myEmail };
      const result = await userCollection.findOne(query);
      console.log("user email result", result);
      res.send(result);
    })

    app.patch('/usersUser/:email', async (req, res) => {
      const item = req.body;
      const myEmail = req.params.email;
      const filter = { email: myEmail };
      const updatedDoc = {
        $set: {
          name: item.name,
          photo: item.photo,
          address: item.address
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
      
    })

    // admin related api
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin })
    })
    

    app.patch('/users/admin/:id',verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    //creator related api
    app.get('/users/creator/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query);
      let creator = false;
      if (user) {
        creator = user?.role === 'creator';
      }
      res.send({ creator })
    })


    app.patch('/users/creator/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'creator'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })


    //CONTEST related api
    app.post('/contests', async (req, res) => {
      const contest = req.body;
      const result = await contestCollection.insertOne(contest);
      res.send(result);
    })

    app.get('/contests', async(req, res)=>{
      const result = await contestCollection.find().toArray();
      res.send(result);
    })


    app.get('/contestsHome', async (req, res) => {
      // const id = req.body();
      const query = req.body;
      const options = {
          // Sort returned documents in ascending order by title (A->Z)
          sort: { currentTime: -1 },
      };
      const cursor = contestCollection.find(query, options);
      const result = await cursor.toArray();
      res.send(result);
  })

  
    app.get('/contest/:id', async(req, res)=>{
      const id = req.params.id;
      const query = { _id : new ObjectId(id) }
      const result = await contestCollection.findOne(query);
      res.send(result);
    })

    app.patch('/contest/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          contestName: item.contestName,
          contestImage: item.contestImage,
          contestPrice: item.contestPrice,
          priceMoney: item.priceMoney,
          taskInstruction: item.taskInstruction,
          contestType: item.contestType,
          contestDescription: item.contestDescription,
          contestDeadLine: item.contestDeadLine,
          adminComment: item.adminComment
        }
      }
      const result = await contestCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.patch('/adminComment/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          adminComment: item.adminComment
        }
      }
      const result = await contestCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    app.patch('/status/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: item.status
        }
      }
      const result = await contestCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.patch('/participation/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          participantCount: item.participantCount
        }
      }
      const result = await contestCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    

    app.get('/contests/:email', async (req, res) => {
      // console.log(req.params.email)
      const myEmail = req.params.email;
      const query = { email: myEmail };
      console.log(myEmail)
      const result = await contestCollection.find(query).toArray();
      res.send(result);
    })

    app.delete('/contests/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await contestCollection.deleteOne(query);
      res.send(result);
    })


    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent');

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    //PAYMENT related api
    app.post('/payments', async(req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      console.log('payment info', payment);
      res.send(paymentResult);
    })

    app.get('/payments', async(req, res)=>{
      const result = await paymentCollection.find().toArray();
      res.send(result);
    })

    //to get contest participate
    app.get('/payments/:email', async(req, res)=>{
      const myEmail = req.params.email;
      const query = { contestParticipateMail: myEmail };
      console.log(myEmail)
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    //to get creator's contest participate
    app.get('/paymentsCreator/:email', async(req, res)=>{
      const myEmail = req.params.email;
      const query = { contestCreatorMail: myEmail };
      console.log(myEmail)
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })



    //to get show submission 
    app.get('/paymentSubmit/:contestId', async(req, res)=>{
      const item = req.params.contestId;
      const query = { contestId: item };
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    

   app.get('/paymentSingle/:id', async(req, res)=>{
      const id = req.params.id;
      const query = { _id : new ObjectId(id) }
      const result = await paymentCollection.findOne(query);
      res.send(result);
    })

    app.patch('/paymentsSubmit/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          link: item.link
        }
      }
      const result = await paymentCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // make winner
    app.patch('/paymentsWinner/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          winner: item.winner
        }
      }
      const result = await paymentCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('ContestLab is running')
})

app.listen(port, () => {
    console.log(`ContestLab is sitting on port ${port}`)
})