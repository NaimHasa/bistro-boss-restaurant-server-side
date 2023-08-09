const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors')
require('dotenv').config()

const port = process.env.PORT || 5000;

//Middleware

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@car-servicing.6whvnzi.mongodb.net/?retryWrites=true&w=majority`;

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
        //Menu data API

        const menuCollection = client.db("bistroMenuItemsDb").collection("menuItems");
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        //reviews data API
        const reviewsCollection = client.db("bistroMenuItemsDb").collection("reviews");
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })

        //carts data API

        const cartCollection = client.db("bistroMenuItemsDb").collection("carts");
        app.post('/carts', async (req, res) => {
            const item = req.body;
            console.log(item)
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })


    } finally {
        // // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Boss is ranning');
})


app.listen(port, () => {
    console.log(`Bistro Boss is Sitting on port ${port} `)
})