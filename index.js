const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);


const port = process.env.PORT || 5000;

//Middleware

app.use(cors())
app.use(express.json())


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}



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

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token });
        })



        // Warning: use verifyJWT before using verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }




        //User related APIS
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        /*
        0-Do not show secure links  to those who should not see the links 
        1 - use Jwt token: verifyJWT
        2- use verify admin 
        
        
        */



        //user sing in info data store API

        const userCollection = client.db("bistroMenuItemsDb").collection("users");
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'User Already exists' });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);

        })

        //Admin users releted API

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);


        })



        //Menu data API

        const menuCollection = client.db("bistroMenuItemsDb").collection("menuItems");
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        //Menu Post API

        app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
            const newItem = req.body;
            const result = await menuCollection.insertOne(newItem);
            res.send(result);

        })


        //Menu Delete API 

        app.delete('/menu/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await menuCollection.deleteOne(query);
            res.send(result);

        })


        //reviews data API
        const reviewsCollection = client.db("bistroMenuItemsDb").collection("reviews");
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result);
        })

        // cart collection APIS
        const cartCollection = client.db("bistroMenuItemsDb").collection("carts");

        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });

        //Admin check API'S  
        /*
        1- security layer: verifyJWT
        2- email same
        3- Check Admin
        */


        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        })


        app.post('/carts', async (req, res) => {
            const item = req.body;
            // console.log(item)
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })

        //cart deleted API

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);


        })
        // // create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //Payment related API 

        const paymentCollection = client.db("bistroMenuItemsDb").collection("payments");
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
            const deleteRusult = await cartCollection.deleteMany(query);
            res.send({ insertResult, deleteRusult });
        });

        app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const products = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            // best way to get sum of the price field is to use group and sum operator
            /*
              await paymentCollection.aggregate([
                {
                  $group: {
                    _id: null,
                    total: { $sum: '$price' }
                  }
                }
              ]).toArray()
            */

            const payments = await paymentCollection.find().toArray();
            const totalRevenue = payments.reduce((sum, payment) => sum + payment.price, 0)
            const revenue = parseFloat(totalRevenue).toFixed(2);

            res.send({
                revenue,
                users,
                products,
                orders
            })
        })


        /**
         * ---------------
         * BANGLA SYSTEM(second best solution)
         * ---------------
         * 1. load all payments
         * 2. for each payment, get the menuItems array
         * 3. for each item in the menuItems array get the menuItem from the menu collection
         * 4. put them in an array: allOrderedItems
         * 5. separate allOrderedItems by category using filter
         * 6. now get the quantity by using length: pizzas.length
         * 7. for each category use reduce to get the total amount spent on this category
         * 
        */
        app.get('/order-stats', verifyJWT, verifyAdmin, async (req, res) => {
            const pipeline = [
                {
                    $lookup: {
                        from: 'menuItems',
                        localField: 'menuItems',
                        foreignField: '_id',
                        as: 'menuItemsData'
                    }
                },
                {
                    $unwind: '$menuItemsData'
                },
                {
                    $group: {
                        _id: '$menuItemsData.category',
                        count: { $sum: 1 },
                        total: { $sum: '$menuItemsData.price' }
                    }
                },
                {
                    $project: {
                        category: '$_id',
                        count: 1,
                        total: { $round: ['$total', 2] },
                        _id: 0
                    }
                }
            ];

            const result = await paymentCollection.aggregate(pipeline).toArray()
            res.send(result)

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