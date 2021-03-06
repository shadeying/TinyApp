const express = require("express");
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");
const bcrypt = require("bcrypt");
const methodOverride = require("method-override");
const morgan = require("morgan");
const app = express();
const PORT = 8080; // default port 8080

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieSession({
  name: "session",
  keys: ["pizza"]
}));
app.use(methodOverride("_method"));
app.use(morgan("dev"));

const urlDatabase = {};
// const urlDatabase = {
//   b6UTxQ: { longURL: "https://www.tsn.ca", userID: "aJ48lW", date: "Friday, May 10, 2019", visits: 0, visitors: 2},
//   i3BoGr: { longURL: "https://www.google.ca", userID: "aJ48lW", date: "Friday, May 10, 2019", visits: 0, visitors: 1}
// };

//object which stores and access users in the app
const users = {};
// const users = {
//   "userRandomID": {
//     id: "userRandomID",
//     email: "user@example.com",
//     password: "purple-monkey-dinosaur"
//   },
//  "user2RandomID": {
//     id: "user2RandomID",
//     email: "user2@example.com",
//     password: "dishwasher-funk"
//   }
// }

const visitors = {};
// const visitors = {
//   "visitorRandomID": {
//     b6UTxQ: ["Friday, May 10, 2019", "Monday, May 13, 2019"],
//     i3BoGr: ["Friday, May 10, 2019"]
//    }
// }

app.get("/", (req, res) => {
  if(req.session.user_id){
    res.redirect("/urls");
  }else{
    res.redirect("/login");
  }
});

app.get("/urls", (req, res) => {
  let templateVars = {
    urls: urlsForUser(req.session.user_id),
    user: userLookUp(req.session.user_id),
  };
  res.render("urls_index", templateVars);
  console.log(templateVars.urls)
});

app.get("/urls/new", (req, res) => {
  if(!req.session.user_id){
    res.redirect("/login");
  }else{
     let templateVars = {user: userLookUp(req.session.user_id)};
     res.render("urls_new", templateVars);
  }
});

//generate id for new URL which we receive from the form, then store them in urlDatabase
app.post("/urls", (req, res) => {
  const id = generateRandomString();
  let options = {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  urlDatabase[id] = {};
  urlDatabase[id].longURL = req.body.longURL;
  urlDatabase[id].userID = req.session.user_id;
  urlDatabase[id].visits = 0;
  urlDatabase[id].date = new Date().toLocaleString("en-us", options);
  res.redirect('/urls/' + id);
});

app.get("/urls/:shortURL", (req, res) => {
  let templateVars = {
    urls: urlsForUser(req.session.user_id),
    shortURL: req.params.shortURL,
    user: userLookUp(req.session.user_id),
    allURLs: urlDatabase,
    visitors: shortURLvisitHistory(req.params.shortURL),
    numberOfVisitors: uniqueVisitorsCounter(shortURLvisitHistory(req.params.shortURL))
  };
  res.render("urls_show", templateVars);
});

app.put("/urls/:shortURL", (req, res) => {
  if(req.session.user_id){
    const newLongURL = req.body.newLongURL;
    urlDatabase[req.params.shortURL].longURL = newLongURL;
    res.redirect("/urls");
  }else{
    res.redirect("/login");
  }
});

//short URL can be accessed by anyone, even if users are not logged in
app.get("/u/:shortURL", (req, res) => {
  const shorturl = req.params.shortURL;
  const options = {
          weekday: "long",
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        };
  for(let id in urlDatabase){
    if(id === shorturl){
      if(!req.session.visitor_id){
        const visitorID = generateRandomString();
        visitors[visitorID] = {};
        visitors[visitorID][id] = [];
        req.session.visitor_id = visitorID;
      }
      urlDatabase[id].visits ++;
      if(!visitors[req.session.visitor_id][id]){
        visitors[req.session.visitor_id][id] = [new Date().toLocaleString("en-us", options)];
      }else{
        visitors[req.session.visitor_id][id].push(new Date().toLocaleString("en-us", options));
      }
      const longurl = urlDatabase[id].longURL;
      res.redirect(longurl);
    }
  }
  res.send("<h1>Can't find what you are looking for :|</h1>");
});

//delete an url from urlDatabase
//then redirect client back to index page
app.delete("/urls/:shortURL", (req, res) => {
  if(req.session.user_id){
    delete urlDatabase[req.params.shortURL];
    res.redirect("/urls");
  }else{
    res.redirect("/login");
  }
});

//set a session cookie named user_id for successful login
// redirect the browser back to the /urls page
app.post("/login", (req, res) => {
  let id = emailExists(req.body.email);
  if(!id){
    res.status(403).send("<h1>E-mail cannot be found :|</h1>");
  }else{
    if(!bcrypt.compareSync(req.body.password, users[id].password)){
      res.status(403).send("<h1>Invalid password :|</h1>");
    }
    req.session.user_id = id;
    res.redirect("/urls");
  }
});

app.get("/login", (req, res) => {
  if(req.session.user_id){
    res.redirect("/urls");
  }else{
    let templateVars = {user: userLookUp(req.session.user_id)};
    res.render("login", templateVars);
  }
});

app.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/urls");
});

app.get("/register", (req, res) => {
  if(req.session.user_id){
    res.redirect("/urls");
  }else{
    let templateVars = {user: userLookUp(req.session.user_id)};
    res.render("register", templateVars);
  }
});

app.post("/register", (req, res) => {
  if(req.body.email === "" || req.body.password === "" || emailExists(req.body.email)){
    if(emailExists(req.body.email)){
      res.status(400).send("<h2>Error 400 :|<h2><p><h4>You already had an account :|</h4></p>");
    }else{
      res.status(400).send("<h2>Error 400 :|<h2><p><h4>Don't leave any of the field blank! That's not FUNNY :|</h4></p>");
    }
  }else{
    const id = generateRandomString();
    users[id] = {};
    users[id].id = id;
    users[id].email = req.body.email;
    const password = req.body.password;
    const hashedPassword = bcrypt.hashSync(password, 10);
    users[id].password = hashedPassword;
    req.session.user_id = id;
    res.redirect("/urls");
  }
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});

function generateRandomString() {
  let result = "";
  const all = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for(var i = 0; i < 6; i++){
    result += all.charAt(Math.floor(Math.random() * all.length));
  }
  return result;
}

function emailExists(email){
  for(let id in users){
    if(email === users[id].email){
      return id;
    }
  }
  return;
}

function userLookUp(userID){
  for(let id in users){
    if(userID === id){
      return users[id];
    }
  }
}

function urlsForUser(id){
  const object = {};
  for(let shortURL in urlDatabase){
    if(urlDatabase[shortURL].userID === id){
      object[shortURL] = {};
      object[shortURL].longURL = urlDatabase[shortURL].longURL;
      object[shortURL].date = urlDatabase[shortURL].date;
      object[shortURL].visits = urlDatabase[shortURL].visits;
    }
  }
  return object;
}

function shortURLvisitHistory(shorturl){
  const obj = {};
  for(let id in visitors){
    for(let url in visitors[id]){
      if(url === shorturl){
        obj[id] = visitors[id][url];
      }
    }
  }
  return obj;
}
//   obj = {
//     ab7yhG : ["Friday, May 10, 2019", "Monday, May 13, 2019"],
//     ghU8y6 : ["Saturday, May 11, 2019"]
//   }

function uniqueVisitorsCounter(obj){
  let count = 0;
  for(let visitorID in obj){
    count ++;
  }
  return count;
}






