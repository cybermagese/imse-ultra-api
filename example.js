const {Api} = require('.');

const api = new Api("10.0.48.94","config","ef56","sv");

api.listIOChannels()
.then(data=>{
    console.log("Operation result:",data);
})
.then(()=>{
    api.logout();
})


