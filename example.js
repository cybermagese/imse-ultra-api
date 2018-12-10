const {Api} = require('.');

const api = new Api({host:"10.0.48.94", username:"config", password:"ef56", lang:"sv"});

api.listIOChannels()
.then(data=>{
    console.log("Operation npm result:",data);
})
.then(()=>{
    api.logout();
})


