//Load Library 
const express = require('express');
const mysql =  require('mysql2/promise');
const bodyParser = require('body-parser');
const secureEnv = require('secure-env');
const cors = require('cors');

//Create an instance of express
const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json({limit: '50mb'}));

global.env = secureEnv({secret: 'isasecret'});

//Define PORT
const PORT = global.env.APP_PORT || 3000;

// Create the Database Connection Pool
const pool = mysql.createPool({
    host: global.env.MYSQL_SERVER || 'localhost',
    port: parseInt(global.env.MYSQL_SVR_PORT) || 3306,
    database: global.env.MYSQL_SCHEMA,
    user: global.env.MYSQL_USERNAME,
    password: global.env.MYSQL_PASSWORD,
    connectionLimit: parseInt(global.env.MYSQL_CONN_LIMIT) || 4,
    timezone: process.env.DB_TIMEZONE || '+08:00'
})

//Make a Closure, Take in SQLStatement and ConnPool
const makeQuery = (sql, pool) => {
    return (async (args) => {
        const conn = await pool.getConnection();
        try {
            let results = await conn.query(sql, args || []);
            //Only need first array as it contains the query results.
            //index 0 => data, index 1 => metadata
            return results[0];
        }
        catch(err) {
            console.error('Error Occurred during Query', err);
        }
        finally{
            conn.release();
        }
    })
}

const SQL_INSERTORDER = "INSERT INTO ORDERS_WORKSHOP23 (employee_id, customer_id) values ( ? , ? ) ";
const SQL_INSERTORDERDETAIL = "INSERT INTO ORDER_DETAILS_WORKSHOP23 (order_id, product_id) values ( ? , ? )";

const insertOrder = makeQuery(SQL_INSERTORDER, pool);
const insertOrderDetail = makeQuery(SQL_INSERTORDERDETAIL, pool);

const insertOrders = async (p1, p2, p3) => {
    const conn =  await pool.getConnection();

    try {
        await conn.beginTransaction();

        let results = await conn.query("INSERT INTO ORDERS_WORKSHOP23 (employee_id, customer_id) values ( ? , ? )", [p1, p2]);
        console.info(results[0].insertId);

        let results2 = await conn.query("INSERT INTO ORDER_DETAILS_WORKSHOP23 (order_id, product_id) values ( ? , ? )", [results[0].insertId , p3]);
        console.info(results2[0].insertId);

        await conn.commit();
    }
    catch(err) {
        console.info(err);
        conn.rollback();
    }
    finally {
        conn.release();
    }
}

//Write Resources
app.post('/order', (req, res) => {
    const employeeId = req.body.employeeId;
    const customerId = req.body.customerId;
    const productId = req.body.productId;

    insertOrders(employeeId, customerId, productId)
        .then(data => {
            console.info(data);
            res.status(200).json({msg: 'success'});
        })
})

//Start Express
pool.getConnection()
    .then(conn => {
        const param1 = Promise.resolve(conn);
        const param2 = conn.ping();
        return Promise.all( [ param1, param2 ] );
    })
    .then(results => {
        const conn = results[0];
        app.listen(PORT, () => {
            console.info(`Server Started on PORT ${PORT} at ${new Date()}`);
        })
        conn.release();
    })
    .catch(err => {
        console.error('Error in connection to mysql', err);
    })