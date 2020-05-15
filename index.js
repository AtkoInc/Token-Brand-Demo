require('dotenv').config()
const express = require('express');
const exphbs  = require('express-handlebars');
const session = require("express-session");
var createError = require('createerror');
const bodyParser = require('body-parser')
const querystring = require('querystring');
const ExpressOIDC = require("@okta/oidc-middleware").ExpressOIDC;

const PORT = process.env.PORT || "3000";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var hbs = exphbs.create({
    // Specify helpers which are only registered on this instance.
    helpers: {
        jwt: function (token){
            var atob = require('atob');
            if (token != null) {
                var base64Url = token.split('.')[1];
                var base64 = base64Url.replace('-', '+').replace('_', '/');
                return JSON.stringify(JSON.parse(atob(base64)), undefined, '\t');
            } else {
                return "Invalid or empty token was parsed"
            }
        }
    }
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

app.use("/static", express.static("static"));

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
const DelegationHandler = require('./delegationHandler')

router.get("/",ensureAuthenticated(), async (req, res, next) => {
  dh = new DelegationHandler()
  var delegatedIds = await dh.getDelegateIds(req)
  console.log(delegatedIds)
    res.render("index",{
        brand: process.env.BRAND,
        user: req.userContext.userinfo,
        idtoken: req.userContext.tokens.id_token,
        accesstoken: req.userContext.tokens.access_token,
        delegatedAuthority: delegatedIds
       });
});

router.post("/exerciseAuthority",ensureAuthenticated(), async (req, res, next) => {
  console.log(req.body)
  dh = new DelegationHandler()
  var id = await dh.registerDelegation(req,req.body.identity)
  const nonce = id;
  const state = id;
  const params = {
    nonce,
    state,
    client_id: process.env.CLIENT_ID,
    redirect_uri: process.env.REDIRECT_URI,
    scope: 'openid profile',
    response_type: 'code',
  };
  console.log(req)
  req.session[ `oidc:`+process.env.ISSUER] = {
    nonce,
    state
  };
  const url = process.env.ISSUER+`/v1/authorize?${querystring.stringify(params)}`;
  return res.redirect(url);
});
app.use(router)

const OktaJwtVerifier = require('@okta/jwt-verifier');

const oktaJwtVerifier = new OktaJwtVerifier({
  issuer: process.env.ISSUER,
  clientId: process.env.CLIENT_ID,
});

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
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