// Built-in Node.js modules
let fs = require('fs');
let path = require('path');
let Chart = require('chart.js');

// NPM modules
let express = require('express');
let sqlite3 = require('sqlite3');

let public_dir = path.join(__dirname, 'public');
let template_dir = path.join(__dirname, 'templates');
let db_filename = path.join(__dirname, 'db', 'usenergy.sqlite3');

let app = express();
let port = 8000;

// open usenergy.sqlite3 database
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.log('Error opening ' + db_filename);
    }
    else {
        console.log('Now connected to ' + db_filename);
    }
});

app.use(express.static(public_dir)); // serve static files from 'public' directory


// GET request handler for home page '/' (redirect to /year/2018)
app.get('/', (req, res) => {
    res.redirect('/year/2018');
});

// GET request handler for '/year/*'
app.get('/year/:selected_year', (req, res) => {
    console.log(req.params.selected_year);
    fs.readFile(path.join(template_dir, 'year.html'), 'utf-8', (err, template) => {
        // modify `template` and send response
        // this will require a query to the SQL database
        
        //Put in selected year
        template = template.replace("YEAR_HEADER", req.params.selected_year);   
        template = template.replace("year", "year = " + req.params.selected_year);

        //Get data from database for the selected year
        let query = 'SELECT state_abbreviation, coal, natural_gas, nuclear, petroleum, renewable FROM Consumption WHERE year = ?';
        let params = [req.params.selected_year];
        db.all(query, params, (err, rows) => {
            if (err) {
                console.log("Error", err.message);
            }

            //Make table headers
            let table = "<table><tr><th>State</th><th>Coal Consumption</th><th>Gas Consumption</th><th>Nuclear Consumption</th><th>Petroleum Consumption</th><th>Renewable Consumption</th><th>Total Energy Consumption</th></tr>";
            let coal_count = 0;
            let natural_gas_count = 0;
            let nuclear_count = 0;
            let petroleum_count = 0;
            let renewable_count = 0;
            var i = 0;
            for (i = 0; i < rows.length; i++) {
                //Insert table rows
                table = table + "<tr>";
                table = table + "<td>" + rows[i].state_abbreviation + "</td>";
                table = table + "<td>" + rows[i].coal + "</td>";
                table = table + "<td>" + rows[i].natural_gas + "</td>";
                table = table + "<td>" + rows[i].nuclear + "</td>";
                table = table + "<td>" + rows[i].petroleum + "</td>";
                table = table + "<td>" + rows[i].renewable + "</td>";
                let total = rows[i].coal + rows[i].natural_gas + rows[i].nuclear + rows[i].petroleum + rows[i].renewable;
                table = table + "<td>" + total + "</td>";
                table = table + "</tr>"

                //Count up summary statistics
                coal_count = coal_count + rows[i].coal;
                natural_gas_count = natural_gas_count + rows[i].natural_gas;
                nuclear_count = nuclear_count + rows[i].nuclear;
                petroleum_count = petroleum_count + rows[i].petroleum;
                renewable_count = renewable_count + rows[i].renewable;
            }
            table = table + "</table>";
            //Insert table into template
            template = template.replace("TABLE", table);

            //Insert summary statistics into template
            template = template.replace("coal_count", "coal_count = " + coal_count);
            template = template.replace("natural_gas_count", "natural_gas_count = " + natural_gas_count);
            template = template.replace("nuclear_count", "nuclear_count = " + nuclear_count);
            template = template.replace("petroleum_count", "petroleum_count = " + petroleum_count);
            template = template.replace("renewable_count", "renewable_count = " + renewable_count);
            
            res.status(200).type('html').send(template); // <-- you may need to change this
        });

    });
});

// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    console.log(req.params.selected_state);
    fs.readFile(path.join(template_dir, 'state.html'), (err, template) => {
        // modify `template` and send response
        // this will require a query to the SQL database

        res.status(200).type('html').send(template); // <-- you may need to change this
    });
});

// GET request handler for '/energy/*'
app.get('/energy/:selected_energy_source', (req, res) => {
    console.log(req.params.selected_energy_source);
    fs.readFile(path.join(template_dir, 'energy.html'), (err, template) => {
        // modify `template` and send response
        // this will require a query to the SQL database

        res.status(200).type('html').send(template); // <-- you may need to change this
    });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});

