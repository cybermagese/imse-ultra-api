# imse.ultra-api

Api for Abelko's IMSE Ultra family of BAC/BMS/PLC

## Installation

```bash
> npm install imse-ultra-api
```

## Usage

You need the ip of your IMSE Ultra unit and an account on it.

The api constructor takes a config argument with the following parameters, all optionals with default to factory settings in parentesis and swedish

* host ('10.0.48.94')
* username ('config')
* password ('ef56') - please change the password
* lang ('sv') - use 'en' for english
* port (443)
* path ('') - path if your unit is behind a proxypass

### Example

```js
const {Api} = require('.');

const api = new Api({host:"10.0.48.94", username:"config", password:"ef56", lang:"sv"});

api.listIOChannels() //operation
.then(data=>{
    console.log("Operation npm result:",data);
})
.then(()=>{
    api.logout(); //always logout or you create a lot of sessions
})
```

## Version history

### 0.2.4 (2019-04-02)

* fixes setcookie bug when upgrading PLC