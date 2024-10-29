const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const port = 3006;

app.use(cors());
app.use(express.json());

const config = {
    user: 'bh',
    password: 'bh02',
    server: 'localhost', 
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

// Add this endpoint to fetch login credentials
app.get('/api/login-credentials', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT Username, Password FROM loginCredentials');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching login credentials:', err);
        res.status(500).send('Internal Server Error');
    }
});

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

app.post('/api/tasks', async (req, res) => {
    const { taskName, assignedTo, taskStatus } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TaskName', sql.VarChar, taskName)
            .input('AssignedTo', sql.VarChar, assignedTo)
            .input('TaskStatus', sql.VarChar, taskStatus)
            .query('INSERT INTO Tasks (TaskName, AssignedTo, TaskStatus) VALUES (@TaskName, @AssignedTo, @TaskStatus)');
        res.status(201).send('Task created');
    } catch (err) {
        console.error('Error creating task:', err);
        res.status(500).send('Internal Server Error');
    }
});


app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    console.log('/api/tasks/:id')
    console.log('id=' +id)
    const { taskName, assignedTo, taskStatus } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('TaskName', sql.VarChar, taskName)
            .input('AssignedTo', sql.VarChar, assignedTo)
            .input('TaskStatus', sql.VarChar, taskStatus)
            .input('TaskID', sql.Int, id)
            .query('UPDATE Tasks SET TaskName = @TaskName, AssignedTo = @AssignedTo, TaskStatus = @TaskStatus WHERE Id = @TaskID');
        res.send('Task updated');
    } catch (err) {
        console.error('Error updating task:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        console.log('inside delete')
        console.log('id=' +id)
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
