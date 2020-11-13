// Built-in Node.js modules
let fs = require('fs');
let path = require('path');

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
    if (req.params.selected_year < 1960 || req.params.selected_year > 2018){
        res.status(404).send("Error, no data for "+ req.params.selected_year);
    }
    else{
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
                else{
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
                    
                    //Read in navigation bar
                    fs.readFile(path.join(template_dir, 'navigationBar.html'), 'utf-8', (err, navigationBar) => {
                        template = template.replace("Navigation Bar", navigationBar);


                        res.status(200).type('html').send(template); // <-- you may need to change this
                    });
                }
            });
        });
    }
});

app.get('/state', (req, res) => {
    res.redirect('/state/MN');
});

// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    console.log("Request for state: " + req.params.selected_state);
    let stateAbb = req.params.selected_state.toUpperCase();
    let query = "SELECT * FROM States;";
    db.all(query, [], (err, rows) => {
        if(err){
            res.status(500).send('Database access error');
            console.log("Error ", err.message);   
        }
        else{
            let found = false;
            let rowIndex = -1;
            for(let i in rows){
                if(rows[i].state_abbreviation == stateAbb){
                    found = true;
                    rowIndex = parseInt(i);
                    break;
                }
            }
            if(!found){
                for(let i in rows){
                    if(rows[i].state_name.toUpperCase() == stateAbb){
                        found = true;
                        rowIndex = parseInt(i);
                        break;
                    }
                }
                if(found){
                    console.log("Redirect to: " + rows[rowIndex].state_abbreviation);
                    res.redirect('/state/' + rows[rowIndex].state_abbreviation);
                }
                else{
                    res.status(404).send('State not found');
                }
            }
            else if(found){
                fs.readFile(path.join(template_dir, 'state.html'), 'utf-8', (err, template) => {
                    if(err){
                        res.status(500).send('Server read error');
                    }
                    else{
                        let stateNm = rows[rowIndex].state_name;
                        stateAbb = rows[rowIndex].state_abbreviation;
                        template = template.replace("!!TITLE!!", stateNm);
                        template = template.replace("!!NAME!!", stateNm);
                        let prevState = "";
                        let nextState = "";
                        if(rowIndex == 0){
                            prevState = "WY";                            
                        }
                        else{
                            prevState = rows[rowIndex - 1].state_abbreviation;
                        }
                        if(rowIndex == rows.length-1){
                            nextState = "AK";
                        }
                        else{
                            nextState = rows[rowIndex+1].state_abbreviation;
                        }
                        template = template.replace("!!PREV!!", prevState);
                        template = template.replace("!!NEXT!!", nextState);
                        template = template.replace("!!IMAGE!!", stateNm.toLowerCase());


                        query = "SELECT * FROM Consumption WHERE state_abbreviation = ?";
                        db.all(query, [stateAbb], (err, rows) => {
                            if(err){
                                res.status(500).send('Database access error');
                                console.log("Error ", err.message);   
                            }
                            else{
                                //Make table headers
                                let table = "<table><tr><th>Year</th><th>Coal Consumption</th><th>Gas Consumption</th><th>Nuclear Consumption</th><th>Petroleum Consumption</th><th>Renewable Consumption</th><th>Total Energy Consumption</th></tr>";
                                let coal_count = 0;
                                let natural_gas_count = 0;
                                let nuclear_count = 0;
                                let petroleum_count = 0;
                                let renewable_count = 0;
                                let years = new Array();
                                let coal = new Array();
                                let gas = new Array();
                                let nuclear = new Array();
                                let petro = new Array();
                                let renewable = new Array();
                                var i = 0;
                                for (i = 0; i < rows.length; i++) {
                                    //Insert table rows
                                    table = table + "<tr>";
                                    table = table + "<td>" + rows[i].year + "</td>";
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

                                    years.push(rows[i].year);
                                    coal.push((rows[i].coal/total*100).toPrecision(3));
                                    gas.push(rows[i].natural_gas/total*100);
                                    nuclear.push(rows[i].nuclear/total*100);
                                    petro.push(rows[i].petroleum/total*100);
                                    renewable.push(rows[i].renewable/total*100);

                                }
                                table = table + "</table>";
                                //Insert table into template
                                template = template.replace("!!TABLE!!", table);

                                //Insert summary statistics into template
                                template = template.replace("!!YEAR!!", years);
                                template = template.replace("!!COAL!!", coal);
                                template = template.replace("!!GAS!!", gas);
                                template = template.replace("!!NUCLEAR!!", nuclear);
                                template = template.replace("!!PETRO!!", petro);
                                template = template.replace("!!RENEWABLE!!", renewable);

                                // Populate Chart
                                

                                res.status(200).type('html').send(template); // <-- you may need to change this
                            }
                        })
                    }
                });
            }
        }
    });
});

// GET request handler for '/energy/*'
app.get('/energy/:selected_energy_source', (req, res) => {
    console.log(req.params.selected_energy_source);
    fs.readFile(path.join(template_dir, 'energy.html'), 'utf-8',(err, template) => {
        // modify `template` and send response
        // this will require a query to the SQL database
        
        //Read in navigation bar
        fs.readFile(path.join(template_dir, 'navigationBar.html'), 'utf-8', (err, navigationBar) => {
            template = template.replace("Navigation Bar", navigationBar);


            res.status(200).type('html').send(template); // <-- you may need to change this
        });
    });
});

// This is only a test page. This entire method will be removed eventually.
app.get('/test', (req, res) => {
    console.log(req.params.selected_state);
    fs.readFile(path.join(public_dir, 'test.html'), 'utf8', (err, data) => {
        // modify `template` and send response
        // this will require a query to the SQL database
        
        //Read in navigation bar
        fs.readFile(path.join(template_dir, 'navigationBar.html'), 'utf-8', (err, navigationBar) => {
            data = data.replace("Navigation Bar", navigationBar);


            res.status(200).type('html').send(data); // <-- you may need to change this
        });
    });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});

