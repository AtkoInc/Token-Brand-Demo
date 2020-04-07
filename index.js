require('dotenv').config()
const express = require('express');
const hbs  = require('express-handlebars')
const session = require("express-session");
var createError = require('createerror');
const ExpressOIDC = require("@okta/oidc-middleware").ExpressOIDC;

const PORT = process.env.PORT || "3000";

const app = express();

app.engine('hbs',  hbs( { 
  extname: 'hbs', 
  defaultLayout: 'main', 
  layoutsDir: __dirname + '/views/layouts/',
  partialsDir: __dirname + '/views/partials/',
  helpers: {
      json: function(json){
          return JSON.stringify(json, undefined, '2');
        },
        jwt: function (token){
            var atob = require('atob');
            if (token != null) {
                var base64Url = token.split('.')[1];
                var base64 = base64Url.replace('-', '+').replace('_', '/');
                return JSON.stringify(JSON.parse(atob(base64)), undefined, ' ');
            } else {
                return "Invalid or empty token was parsed"
            }
        }
  }
}));

app.set('view engine', 'hbs');
app.use('/static', express.static('static'));

app.use(session({
  cookie: { httpOnly: true },
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false,
  resave: true
}));
 
let oidc = new ExpressOIDC({
  issuer: process.env.ISSUER,
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  appBaseUrl: process.env.BASE_URI,
  redirect_uri: process.env.REDIRECT_URI,
  scope: 'openid profile'
});

app.use(oidc.router);
  
const router = express.Router();
router.get("/",ensureAuthenticated(), (req, res, next) => {
    res.render("index",{
        brand: process.env.BRAND,
        user: req.userContext.userinfo,
        idtoken: req.userContext.tokens.id_token,
        accesstoken: req.userContext.tokens.access_token
       });
});
app.use(router)

const OktaJwtVerifier = require('@okta/jwt-verifier');

const oktaJwtVerifier = new OktaJwtVerifier({
  issuer: process.env.ISSUER,
  clientId: process.env.CLIENT_ID,
});

app.get("/logout", oidc.forceLogoutAndRevoke(),(req, res) => {
 });

oidc.on('ready', () => {
  app.listen(PORT, () => console.log('app started'));
});

oidc.on("error", err => {
  console.error(err);
});

function ensureAuthenticated(){
  return async (req, res, next) => {
    if (req.isAuthenticated() && req.userContext != null) {
      oktaJwtVerifier.verifyAccessToken(req.userContext.tokens.access_token,process.env.TOKEN_AUD)
      .then(jwt => {
        return next();
      })
      .catch(err => {
        console.log(err)
        res.redirect("/login")
      });      
    }
    else{
      res.redirect("/login")
    }
  }
}