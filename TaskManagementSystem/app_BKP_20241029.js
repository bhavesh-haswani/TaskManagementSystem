const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const port = 3006;

app.use(cors());
app.use(express.json());

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

// Endpoint to fetch login credentials
app.post('/api/login-credentials', async (req, res) => {
    const { username, password } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Username', sql.VarChar, username)
            .input('Password', sql.VarChar, password)
            .query('SELECT Username, Password FROM loginCredentials WHERE Username = @Username AND Password = @Password');

        if (result.recordset.length > 0) {
            res.status(200).json({ message: 'Login successful' });
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }

    } catch (err) {
        console.error('Error fetching login credentials:', err);
        res.status(500).send('Internal Server Error');
    }
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
