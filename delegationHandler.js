const axios = require('axios')

class DelegationHandler {
    async getDelegateIds(req){
        var ids = []
        try{
            var resp = await axios.get(
                process.env.DELGATION_SERVICE_URL + 'agent',
                {headers:{
                    Authorization: "Bearer "+req.userContext.tokens.access_token}
                })
            ids = resp.data;
          }
          catch(err){
            console.log(err)
            // set locals, only providing error in development
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};
      
            // render the error page
            res.status(err.status || 500);
            res.render('error', { title: 'Error' });
          }
        return ids
    }

    async registerDelegation(req,id){
        var resp = await axios.post(
            process.env.DELGATION_SERVICE_URL + 'agent',
            {entityid: id},
            {headers:{
                Authorization: "Bearer "+req.userContext.tokens.access_token}
            })
        return resp.data.id
    }
}

module.exports = DelegationHandler