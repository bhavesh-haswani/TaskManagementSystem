const express = require('express');

const bodyParser = require('body-parser');  //SESSION
const cors = require('cors');
const session = require('express-session'); //SESSION

const sql = require('mssql');

const app = express();
const port = 3006;

const store = new session.MemoryStore();

let sessionUser = '';

// app.use(cors());
app.use(express.json());

app.use(bodyParser.json());

// Configure CORS
app.use(cors({
    origin: 'http://127.0.0.1:5500', // Replace with your frontend URL
    credentials: true // Allow credentials (cookies, authorization headers, etc.)
}));

app.use(session({
    secret: 'JXJXJX123', 
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: { secure: false, 
        httpOnly: true,     // Helps mitigate XSS
        maxAge: null        //1000 * 60 * 60 // 1 hour
    }   
}));

const config = {
    /*user: 'bh',
    password: 'bh02',
    server: 'localhost', */
    user: 'user',
    password: 'bh',
    server: 'DESKTOP-MAIN',
    database: 'TaskManagement',
    options: {
        encrypt: true, 
        trustServerCertificate: true 
    }
};

const poolPromise = new sql.ConnectionPool(config).connect().then(pool => {
    console.log('Connected to MSSQL');
    return pool;
}).catch(err => console.log('Database Connection Failed:', err));

//SESSION
app.get('/api/check-auth', (req, res) => {
    console.log('hello /api/check-auth')
    // console.log(sessionUser)
    console.log('store=');
    console.log(store)
    // console.log(Object.values(store.sessions).map(session => JSON.parse(session).user).filter(Boolean));
    console.log(JSON.parse(Object.values(store.sessions)[0]).user);
    let gg = JSON.parse(Object.values(store.sessions)[0]).user;
    if (gg) {
        res.status(200).json({ userSession: gg , message: 'User is authenticated' }); // User is logged in
    } else {
        res.status(401).send('User is not authenticated'); // Not logged in
    }
});

//fetch login credentials
app.post('/api/login-credentials', async (req, res) => {
    const { username, password } = req.body;
    console.log(username)
    console.log(password)

    // store = new session.MemoryStore();
    store.sessions = {};

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Username', sql.VarChar, username)
            .input('Password', sql.VarChar, password)
            .query('SELECT Username, Password FROM loginCredentials WHERE Username = @Username AND Password = @Password');

        console.log(result);
        console.log(result.recordset[0].Username);    

        if (result.recordset.length > 0) {
            console.log('username=' +username)
            req.session.user = username; // Store user info in session
            sessionUser = username;
            console.log('req.session.user=' +req.session.user);
            console.log('Session ID:', req.sessionID);
            console.log('Session Object:', req.session);
            // localStorage.setItem('username', username);
            res.status(200).json({ userSession: req.session.user , message: 'Login successful' });
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }

    } catch (err) {
        console.error('Error fetching login credentials:', err);
        res.status(500).send('Internal Server Error');
    }
});

//LOGOUT
// app.post('/api/logout', (req, res) => {
//     console.log('logout api')
//     sessionUser = '';
    
//     req.session.destroy(err => {
//         if (err) {
//             return res.status(500).send('Could not log out.');
//         }
//         console.log('jsonparse' +JSON.parse(Object.values(store.sessions)[0]).user);
//         res.json({ message: 'Logged out successfully.' });
//     });
// });

app.post('/api/logout', (req, res) => {
    console.log('logout api');

    // Clear all sessions in the store
    store.sessions = {};
        
        console.log(store)
        console.log('All sessions have been removed.');
        res.json({ message: 'Logged out successfully.' });
    
});

// Fetch tasks including AssignedBy
app.get('/api/tasks', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Tasks');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching tasks:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.put('/api/tasks/:username', async (req, res) => {
    const loggedInUsername = req.params.username;
    console.log('inside username api')
    try {
        const pool = await poolPromise;
        const query = 'SELECT * FROM Tasks WHERE assignedby = @username';
        const result = await pool.request()
            .input('username', sql.VarChar, loggedInUsername)  // Use parameterized query for security
            .query(query);

        res.json(result.recordset);

    } catch (err) {
        console.error('Error :', err);
        res.status(500).send('Internal Server Error');
    }
});

// Insert a new task including AssignedBy
app.post('/api/tasks', async (req, res) => {
    const { taskName, assignedTo, taskStatus, assignedBy } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('TaskName', sql.VarChar, taskName)
            .input('AssignedTo', sql.VarChar, assignedTo)
            .input('TaskStatus', sql.VarChar, taskStatus)
            .input('AssignedBy', sql.VarChar, assignedBy)
            .query('INSERT INTO Tasks (TaskName, AssignedTo, TaskStatus, AssignedBy) OUTPUT INSERTED.Id VALUES (@TaskName, @AssignedTo, @TaskStatus, @AssignedBy)');
        
        const taskId = result.recordset[0].Id;  // Get the new task ID
        res.status(201).json({ Id: taskId });
    } catch (err) {
        console.error('Error creating task:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Update task details including AssignedBy
app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { taskName, assignedTo, taskStatus, assignedBy } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TaskName', sql.VarChar, taskName)
            .input('AssignedTo', sql.VarChar, assignedTo)
            .input('TaskStatus', sql.VarChar, taskStatus)
            .input('AssignedBy', sql.VarChar, assignedBy)
            .input('TaskID', sql.Int, id)
            .query('UPDATE Tasks SET TaskName = @TaskName, AssignedTo = @AssignedTo, TaskStatus = @TaskStatus, AssignedBy = @AssignedBy WHERE Id = @TaskID');
        res.send('Task updated');
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).send('Internal Server Error');
    }
});


app.put('/api/usernames/:username', async (req, res) => {
    const loggedInUsername = req.params.username;
    console.log('inside username api')
    try {
        const pool = await poolPromise;
        const query = 'SELECT username FROM loginCredentials WHERE username <> @username';
        const result = await pool.request()
            .input('username', sql.VarChar, loggedInUsername)  // Use parameterized query for security
            .query(query);

        // Extract usernames from the result set
        const usernames = result.recordset.map(row => row.username);
        console.log(usernames)
        res.json({ usernames });

    } catch (err) {
        console.error('Error retrieving usernames:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TaskID', sql.Int, id)
            .query('DELETE FROM Tasks WHERE Id = @TaskID');
        res.send('Task deleted');
    } catch (err) {
        console.error('Error deleting task:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
