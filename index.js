const express = require('express')
const app = express()
const port = 5000
const bodyParser = require('body-parser')
const admin = require("firebase-admin");
const fileUpload = require('express-fileupload')
const fs = require('fs-extra')
const MongoClient = require('mongodb').MongoClient
const cors = require('cors')


app.use(bodyParser.json())
app.use(cors())
app.use(express.static('services'));
app.use(fileUpload())
require('dotenv').config()

const serviceAccount = require("./creative-agency-8bae3-firebase-adminsdk-saz3y-cefcefb015.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://creative-agency-8bae3.firebaseio.com"
});

const uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0-shard-00-00.zzmoj.mongodb.net:27017,cluster0-shard-00-01.zzmoj.mongodb.net:27017,cluster0-shard-00-02.zzmoj.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-oktw2x-shard-0&authSource=admin&retryWrites=true&w=majority`;

app.get('/', (req, res) => {
    res.send("hello world")
})

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })

client.connect(err => {
    const serviceCollection = client.db(process.env.DB_NAME).collection('services')
    const reviewCollection = client.db(process.env.DB_NAME).collection('reviews')
    const orderCollection = client.db(process.env.DB_NAME).collection('orders')
    const adminCollection = client.db(process.env.DB_NAME).collection('admins')
        
    app.post('/addOrder', (req, res) => {
        const order = req.body;
        console.log('working');
        orderCollection.insertOne(order)
            .then(result => {
                console.log(result)
                res.send(result.insertedCount > 0)
            })
    });
  
    app.get('/orderdashboard', (req, res) => {
        const bearer = req.headers.authorization;
        if (bearer && bearer.startsWith('Bearer ')) {
            const idToken = bearer.split(' ')[1];
            admin.auth().verifyIdToken(idToken)
                .then(function (decodedToken) {
                    const tokenEmail = decodedToken.email;
                    const queryEmail = req.query.email;
                    if (tokenEmail == queryEmail) {
                        orderCollection.find({ email: queryEmail})
                            .toArray((err, documents) => {
                                res.status(200).send(documents);
                            })
                    }
                    else{
                        res.status(401).send('un-authorized access')
                    }
                }).catch(function (error) {
                    res.status(401).send('un-authorized access')
                });
        }
        else{
            res.status(401).send('un-authorized access')
        }
    })
   
    app.post('/addReview', (req, res) => {
        const review = req.body;
        reviewCollection.insertOne(review)
            .then(result => {
                console.log(result)
                res.send(result.insertedCount > 0)
            })
    });
     app.get('/review',(req, res) => {
        reviewCollection.find({}).limit(3)
        .toArray((err,documents) => {
            res.send(documents)
        })
    })

    
    app.post('/addAService', (req, res) => {
        const file = req.files.file;
        const title = req.body.title;
        const description = req.body.description;
        const newImg = file.data;
        const encImg = newImg.toString('base64');

        var image = {
            contentType: file.mimetype,
            size: file.size,
            img: Buffer.from(encImg, 'base64')
        };

        serviceCollection.insertOne({ title, description, image })
            .then(result => {
                res.send(result.insertedCount > 0);
            })
    })
   
    app.patch("/updateStatus/:id",(req,res)=>{
            orderCollection.updateOne({_id:ObjectId(req.params.id)},
                {$set:{status:req.body.updatedStatus}})
                .then(result=>res.send(result.matchedCount>0))
        })
    
    app.post('/makeAdmin',(req,res)=>{     
        const email = req.body.email   
        adminCollection.insertOne({email:email})
        .then(result =>{ 
                res.send(result.insertedCount>0 )
        })                
    })   
  
    app.get('/allOrder',(req, res) => {
        orderCollection.find({})
        .toArray((err,documents) => {
            res.send(documents)
        })
    })

    app.get('/services', (req, res) => {
        serviceCollection.find({})
            .toArray((err, documents) => {
                res.send(documents);
            })
    });

    app.post('/isAdmin', (req, res) => {
        const email = req.body.email;
        adminCollection.find({ email: email })
            .toArray((err, admins) => {
                res.send(admins.length > 0);
            })
    })
});

app.listen(process.env.PORT || port)
