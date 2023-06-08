const express = require('express');
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'unauthorized access'});
  }
  // bearer
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
    if(err){
      return res.status(401).send({error: true, message: 'unauthorized access'})
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

    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h'})
      res.send({token})
    })

    // ADMIN VERIFICATION
    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message'});
      }
      next();
    }

    // INSTRUCTOR VERIFICATION
    const verifyInstructor = async(req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden message'});
      }
      next();
    }

    // Users API

    app.get('/users',async(req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result)
    })


    app.post('/users', async(req,res) => {
        const user = req.body;
        // console.log(user);
        const query = {email: user.email}
        const existingUser = await usersCollection.findOne(query);
        // console.log(existingUser);
        if(existingUser){
            return res.send({ message: 'user already exists'})
        }
        const result = await usersCollection.insertOne(user);
        console.log(result);
        res.send(result);
    })

    app.get('/users/admin/:email', verifyJWT, async(req, res) => {
      const email = req.params.email

      if(req.decoded.email !== email){
        res.send({admin: false})
      }

      const query = {email: email}
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin'}
      res.send(result);
    })

    // DASHBOARD ROLES
    app.get('/currentuser/:email', async(req,res) => {
      const email = req.params.email
      // console.log(email);
      const result = await usersCollection.find({email: email}).toArray()
      res.send(result);
    })


    // TO MAKE ADMIN
    app.patch('/users/admin/:id', async(req,res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    
    // TO MAKE INSTRUCTOR
    app.patch('/users/instructor/:id', async(req,res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // IMPORTANT REMINDER TO MYSELF: IF CODE NOT WORKING REMOVE THIS JWT AND VERIFY!

    // ADD A CLASS API
    app.post('/classes', verifyJWT, verifyInstructor, async(req, res) => {
      const classItem = req.body;
      const result = await classCollection.insertOne(classItem)
      res.send(result);
    })

    // MY CLASSES API

    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    })

    // UPDATE SPECIFIC CLASS DETAIL

    app.put('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const body = req.body
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