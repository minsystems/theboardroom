// Get the Host from Environment or use default
const host = '209.205.211.245';

// Get the User for DB from Environment or use default
const user = 'minloans_boardroom';

// Get the Password for DB from Environment or use default
const password = 'FReakyboygeniuse123';

// Get the Database from Environment or use default
const database = 'minloans_boardroom';

// Create the connection with required details
const params = mysql.createConnection({
    host, user, password, database,
});

const query = 'SELECT * FROM users';

// make to connection to the database.
module.exports = async (params) => new Promise((resolve, reject) => {
    const connection = mysql.createConnection(params);
    connection.connect(error => {
        if (error) {
            reject(error);
            return;
        }
        resolve(connection);
        console.log(connection)
    })
});
