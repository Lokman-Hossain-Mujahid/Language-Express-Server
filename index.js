const express = require('express');
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uhtjylk.mongodb.net/?retryWrites=true&w=majority`;

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
    await client.connect();

    const database = client.db("LanguageDb")
    const usersCollection = database.collection('user')
    const classCollection = database.collection('classes')
    const SelectedClassCollection = database.collection('SelectedClasses')
    const paymentCollection = database.collection('payments')

    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // ADMIN VERIFICATION
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // INSTRUCTOR VERIFICATION
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    // ALL USERS API

    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })


    app.post('/users', async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      // console.log(existingUser);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.send(result);
    })


    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })

    // DASHBOARD ROLES
    app.get('/currentUser/:email', async (req, res) => {
      const email = req.params.email
      // console.log(email);
      const result = await usersCollection.find({ email: email }).toArray()
      res.send(result);
    })


    // TO MAKE ADMIN
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })


    // TO MAKE INSTRUCTOR
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })



    // TO APPROVE/DENY

    app.put('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const body = req.body
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: body.status,
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // FEEDBACK
    app.put('/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const body = req.body
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedBack: body.feedBack
        },
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result);
    })



    // IMPORTANT REMINDER TO MYSELF: IF CODE NOT WORKING REMOVE THIS JWT AND VERIFY!

    // ADD A CLASS API
    app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
      const classItem = req.body;
      const result = await classCollection.insertOne(classItem)
      res.send(result);
    })

    // ALL CLASSES

    app.get('/classes', async (req, res) => {

      const result = await classCollection.find().toArray();
      res.send(result);
    })

    // MY CLASSES API

    app.get('/classes/:email', async (req, res) => {
      const email = req.params.email
      const result = await classCollection.find({ instructorEmail: email }).toArray();
      res.send(result);
    })

    // UPDATE SPECIFIC CLASS DETAIL

    app.put('/update/:id', async (req, res) => {
      const id = req.params.id;
      const body = req.body
      console.log(body);
      const filter = { _id: new ObjectId(id) }
      const singleClasses = {
        $set: {
          price: body.price,
          availableSeats: body.availableSeats,
        }
      }
      const result = await classCollection.updateOne(filter, singleClasses)
      res.send(result)
    })



    // SELECTED  CLASSES
    app.put('/manageUserAddClass/:email', async (req, res) => {

      const email = req.params.email;
      const body = req.body.addedClass
      const filter = { email: email }
      const result = await usersCollection.updateOne(filter, { $push: { addedClasses: { $each: body } } });;

      res.send(result)

    })


    //  DELETE CLASSES

    app.put('/deleteClass/:email', async (req, res) => {

      const body = req.body   
      const email = req.params.email;
      // console.log(email);
      const query = { email: email }
      const updatedDoc = {
        $set: {
          addedClasses: body.addedClasses,

        }
      }

      const result = await usersCollection.updateOne(query, updatedDoc);

      res.send(result)

    })

    // PAYMENT INTENT API
    app.post('/create-payment-intent', async(req, res) => {
      const {price} = req.body;
      const amount = price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })


    // PAYMENT RELATED API
    app.post('/payments', async(req,res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    })

    // ALTERNATE PAYMENT RELATED API
    app.put('/managePayment/:email', async (req, res) => {

      const email = req.params.email;
      // console.log(email);
      const body = req.body.paymentHistory
      // console.log(body);
      const filter = { email: email }
      const result = await usersCollection.updateOne(filter, { $push: { paymentHistory: { $each: body } } });;

      res.send(result)

    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Languages are being learned')
})

app.listen(port, () => {
  console.log(`Language express is running on port ${port}`);
})