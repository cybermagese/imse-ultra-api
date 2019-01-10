const querystring = require('querystring');
const https = require('https');
const fetch = require('node-fetch');

/**
 * 
 * Api for Abelko's IMSE Ultra family of BAC/BMS/PLC
 * 
 * 
 * 
**/

'use strict';

const DEF= {
    APPLICATION: {
        TYPE_GRAPH: 0,
        TYPE_SCRIPT:1,
        TYPE_ROOT: 2,
        STOPED:0,
        PAUSED:1,
        RUNNING:2
    },
    ALARM: {
        RESET_AUTO:0,
        RESET_MANUAL:1,
        RESET_ACK:2,
        RESET_EVENT_AUTO:3,
        RESET_EVENT_ACK:4,
        RESET_EVENT_MANUAL:5
    },
    CHANNEL: {
        NORMAL:0,
        PERSISTENT:1,
        PARAMETER:2,
        INPUT:3,
        OUTPUT:4,
        UNKNOWN:5
    },
    FORMAT:{
        NORMAL:1,
        FLOAT:2, // Scientific (1=>format type 10e-6, 0=>format type 0.000006)
        FIXED:3, // Base, Digits
        PICK:4, // set List with list of numbers to pick from type {0,1,1.5,2.5,5,7,8,8.5,10}
        NAMED:5 // set List with format type "{'0':'Off'},{'1':'On'},{'2':'Auto'}" 
    },
    IOCHANNEL: {
        OUTPUT: 0,
        INPUT: 1,
        REGISTER: 2
    },
    IOUNIT: {
        TYPE_ULTRABASE: 0,
        TYPE_GFBI_1: 1,
        TYPE_GFBI_2: 2,
        TYPE_GFBI_TCP: 3,
        TYPE_INTERFACE: 4,
        TYPE_OBJECT: 5,
        TYPE_AEACOM: 6,
        TYPE_SHARE: 7,
        OK: 0,
        TRYING: 1,
        FAILED: 2,
        DISABLED: 3
    }
}

const CODE = ['PUT_OK','PUT_PERMISSIONDENIED','PUT_ILLEAGAL_VALUE','PUT_INTERNAL_ERROR','PUT_NO_RESOURCE','PUT_ILLEGAL_INDEX','PUT_SYNTAX_ERROR','PUT_MISSING_INITVALUES','PUT_PASSWORD_ERROR','PUT_USERNAME_ERROR','PUT_UNKNOWN_CMD','PUT_UNABLE_TO_RUN','PUT_OUTOFMEM','PUT_MISSING_FIELD','PUT_FILENOTFOUND','PUT_INVALID_FILENAME','PUT_FILEEXISTS','PUT_USERNAME_EXIST','PUT_BLOCKED_BY_BACKUP','PUT_STRING_VALUE_TO_LONG','PUT_IDENTIFIER_EXISTS','PUT_FIELD_IS_READONLY','PUT_NULL_FUNCTION_ERROR','PUT_MODBUS_SLAVE_ACTIVATED','PUT_NOT_BELONG_TO_APPLICATION','PUT_IN_USE_DELETE_DENIED','PUT_ILLEGAL_SETTINGS','PUT_INVALID_FILETYPE','PUT_INVALID_IP_ADDRESS','PUT_BLOCKED_BY_MODBUSMAPPING','PUT_ALREADY_RUNNING','PUT_ALREADY_STOPPED','PUT_PARSE_ERROR'];

/**
 * Api({host, username, password, lang, port, path})
 * all parameters are optional and defaults to factory settings
 */
class Api {


    constructor (config) {
        this.host=`10.0.48.94`;
        this.username=`config`;
        this.password=`ef56`;
        this.lang=`sv`;
        this.port=`443`;
        this.path=``;

        var fields = [`host`, `username`, `password`, `lang`, `port`, `path`];
        for(var i=0; i < fields.length; i++) {
            if(config[fields[i]]) this[fields[i]] = config[fields[i]]; 
        }
        
        this.init();

    }

    init() {
        //keep state
        this.cookies= { sessionid: null, lang: null, username: null, limitview: null, permission: null };
        
        //constants
        this.loginOK = false;
        this.ALL = -1;
        /**
         * Definitions of settings 
         */
        this.def = DEF;
        /**
         * array indexed on Code number for type of error in RESULT of requests
         */
        this.Code = CODE;
        this.mode = { get:'query', set:'putpar', logout: 'logout' };

    }

    getBaseUrl() {
        let uri = `https://${this.host}${(this.port==443?"":":"+this.port)}`;
        return uri;
    }

    getLang() {
        return this.lang;
    }
    
    saveCookies(setcookie) {
        for(var i=0;i<setcookie.length;i++) {
            var d = setcookie[i].split("=");
            d[1]= d[1].substring(0,d[1].length-1);
            switch(d[0]){
                case 'sessionid': this.cookies.sessionid = d[1]; break;
                case 'lang': this.cookies.lang = d[1]; break;
                case 'username': this.cookies.username = d[1]; break;
                case 'limitview': this.cookies.limitview = d[1]; break;
                case 'permission': this.cookies.permission = d[1]; break;
                default:
            };
        };
    }

    getCookie() {
        return `sessionid=${this.cookies.sessionid}; lang=${this.cookies.lang}; username=${this.cookies.username};`;
    }

    async login() {
        const agent = new https.Agent({
            rejectUnauthorized: false
        });
        const res = await fetch(`${this.getBaseUrl()}/login.fcgi`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent' : 'imse-ultra-api'
            },
            body: querystring.stringify({
                "username" : this.username,
                "password" : this.password,
                "lang" : this.lang
            }),
            redirect: "manual",
            agent: agent
        })
        .catch(error=>{
            this.loginOK=false;
            //todo log error
        });
        
        if(typeof res=== 'undefined' || res.status!==302) {
            this.loginOK=false;
            //todo log error
        }
        else{

            this.saveCookies(res.headers.raw()['set-cookie']);
            this.loginOK= true;
        }
    }

    /**
     * send a request to IMSE Ultra 
     * returns an array {
     *  {boolean} ok, 
     *  {boolean} authorized, 
     *  {string|array|null}data, 
     *  {https status code} status:res.status, 
     *  {optional array of error codes} errors: [{Code: {integer},n..}]
     * }
     * @param {string} qs query string according to mode
     * @param {string} mode one of this.mode
     * 
     */
    async get(qs,mode=this.mode.get) {
        
        if(this.loginOK!==true){
            await this.login();
        }

        if(this.loginOK) {
            const agent = new https.Agent({
                rejectUnauthorized: false
            });
            const res = await fetch(encodeURI(`${this.getBaseUrl()}/fcgi/streamer.fcgi?${mode}=${qs}`), {
                method: "GET",
                headers: {
                    'User-Agent' : 'imse-ultra-api',
                    'Cookie' : this.getCookie()
                },
                redirect: "manual",
                agent: agent
            })
            .catch(error=>{
                return {ok:false, authorized:true};
                //todo: log error
            });
            if(res.ok) {
                if(mode===this.mode.set){
                    var r= await res.json();
                    
                    var codeOK = true;
                    if(typeof r.RESULT !== 'undefined') {
                        for(var j=0;j<r.RESULT.length;j++) {
                            if(r.RESULT[j]>0)
                                codeOK=false;
                        }
                    }
                    if(r.ParseErrors>0 || r.VerifyErrors>0 || r.ExecErrors>0 || !codeOK) {
                        return {ok:false, authorized:true, data:r.RESULT[0], status:res.status, errors: {ParseErrors:r.ParseErrors, VerifyErrors: r.VerifyErrors, ExecErrors: r.ExecErrors}};
                    }
                    return {ok:true, authorized:true, data:r.RESULT[0], status:res.status};
                }
                if(mode===this.mode.logout) {
                    return {ok:true, authorized:true, data:null, status:res.status};
                }
                return {ok:true, authorized:true, data:await res.json(), status:res.status};
            }else{
                return {ok:false, authorized:true, status: await res.status};
            }

        }else{
            return {ok:false, authorized:false};
        }
    }

    
    async logout() {
        var res = await this.get('yes', this.mode.logout);
        if(res.ok) {
            this.loginOK= false;
            return {ok:true, authorized:false, data:null, status:res.status };
        }else{
            //todo: log error
            return {ok:false, authorized:false, data:null, status:res.status };
        }
    }

/**
 * Returns error type from code number (0-32) see this.CODE
 * @param {integer} code return Code in response.RESULT[n] 
 */
    getCodeType(code) {
        if(typeof code !== 'number' && Number.isInteger(code) && code >= 0 && code < 33) {
            return this.Code[code];
        } else {
            return 'UNKOWND_CODE';
        }
    }

    //the functions below can all be done with the ones above but require more knowledge
    //todo: move them to extend class?

    // general functions    
    
    async edit(type,i,field,value) {
        var res = await this.get(`{EDIT ${type}(${i}){${field}=`+(typeof value === 'string'?`"${value}"`:value)+`;}}`,this.mode.set);
        return res;
    }

    // Alarm functions
    
    async ackAlarm(i,sign="Auto") {
        var res = await this.get(`{CMD ALARM(${i}){Cmd="ACK";Sign="${sign}";}}`,this.mode.set);
        return res;
    }

    async listAlarms(appId=this.ALL,type=this.ALL,verbose=false) {
        var res = await this.get(`ALARM{i>0;AppIndex${(appId!=this.ALL?"="+appId:"")};ParentChn;Identifier;Name;NAME;AppChnAlrmName;ChnAlrmName;Message;MESSAGE;Hint;HINT;Value;PrevValue;Blocked;AlarmType${(type!==this.ALL?"="+type:"")};CondType;Limit1;Limit2;Hysteresis;FilterOn;FilterOff;AlarmTime;ExpectAck;IsAck;AckSign;AckTime;LogMsgFlag;PrevLogMsgFlag;AlarmPrio;State;AccessLevel;WAccess;Flags;}`);
        if(res.ok) { return {ok:true, authorized:true, data:res.data.ALARM, status:res.status}; }else{ return res; }
    }

    async removeAlarm(i) {
        var res = await this.get(`{DELETE ALARM(${i});}`,this.mode.set);
        return res;
    }

    async renameAlarm(i,name) {
        var res = await this.edit('ALARM',i,'Name',name);
        return res;
    }

    // Application functions

    async listApps(verbose=false) {
        var res = await this.get(`APPLICATION{i>0;Identifier;ParentApp;Name;Name;NAME;Description;DESCRIPTION;${(verbose==true?"ScriptFileRes;GraphFileRes;ScriptType;Activate;RunStatus;ScriptStatus;Msg;Print;CompiledSize;AccessLevel;WAccess;":"")}}`);
        if(res.ok) { return {ok:true, authorized:true, data:res.data.APPLICATION, status:res.status}; }else{ return res; }
    }

    async removeApp(i) {
        var res = await this.get(`{DELETE APPLICATION(${i});}`,this.mode.set);
        return res;
    }

    async renameApp(i,name) {
        var res = await this.edit('APPLICATION',i,'Name',name);
        return res;
    }

    async startApp(i) {
        var res = await this.get(`{CMD APPLICATION(${i}){Cmd="RUN";}}`,this.mode.set);
        return res;
    }

    async stopApp(i) {
        var res = await this.get(`{CMD APPLICATION(${i}){Cmd="STOP";}}`,this.mode.set);
        return res;
    }

    // Channel functions

    async formatChannel(i,format=this.def.FORMAT.NORMAL,decimals=0,base=0,digits=0,list='',scientific=0) {
        var res = await this.get(`{EDIT SHOWRESDEF(CHANNEL(${i})){Type=${format};Decimals=${decimals};Base=${base};Digits=${digits};${(list===""?"":'List="'+list+'";')}${(format===this.def.FORMAT.FLOAT?"Scientific="+scientific:"")}}}`,this.mode.set);
        return res;
    }

    async getChannel(i,verbose=false) {
        var res = await this.get(`CHANNEL{i=${i};AppIndex;Identifier;Type;Name;Unit;Dec;TrueValue;Value;ShowResValue;${(verbose===true?"":"NAME;AppChannelName;Validation;LowLimit;HighLimit;MOAllowed;MOActive;MOValue;MODuration;MOTimer;AccessLevel;WAccess;Flags;MOShowResValue;")}}`);
        if(res.ok) { return {ok:true, authorized:true, data:res.data.CHANNEL, status:res.status}; }else{ return res; }
    }

    async listChannels(appId=this.ALL,type=this.ALL,verbose=false) {
        var res = await this.get(`CHANNEL{i>0;AppIndex${(appId>0?"="+appId:"")};Identifier;Type${(type!==this.ALL?"="+type:"")};Name;Unit;Dec;TrueValue;Value;ShowResValue;${(verbose===true?"":"NAME;AppChannelName;Validation;LowLimit;HighLimit;MOAllowed;MOActive;MOValue;MODuration;MOTimer;AccessLevel;WAccess;Flags;MOShowResValue;")}}`);
        if(res.ok) { return {ok:true, authorized:true, data:res.data.CHANNEL, status:res.status}; }else{ return res; }
    }

    async removeChannel(i) {
        var res = await this.get(`{DELETE CHANNEL(${i});}`,this.mode.set);
        return res;
    }

    async renameChannel(i,name) {
        var res = await this.edit('CHANNEL',i,'Name',name);
        return res;
    }
    
    async setChannel(i,value) {
        var res = await this.edit('CHANNEL',i,'Value',value);
        return res;
    }

    
    // IOUnit functions

    async createIOUnit(name="NONAME",serial=0,type=this.def.IOUNIT.TYPE_OBJECT,extra="") {
        var res = await this.get(`{NEW IOUNIT{Name="${name}";Type=${type};${(serial!==0?"DecSN="+serial+";":"")}${extra}}}`,this.mode.set);
        return res;    
    }

    async listIOUnits(i=this.ALL,verbose=false) {
        var res = await this.get(`IOUNIT{i${(i===this.ALL?">0":"="+i)};Identifier;Name;NAME;Motor;Active;ErrorState;Type;DefIndex;Timestamp;AlarmStatus;Timeout;Errors;ReceiveOk;DecSN;DevType;PermanentSN;PermanentType;ProtocolAddress;ProtocolTimeout;NoOfTelegrams;TelegramTimeouts;TelegramStats;${(verbose==true?"RowNr;BackgroundCreate;BackgroundStatus;BackgroundResult;Baudrate;Bits;Stopbits;Parity;Transmitted;Received;NotSent;NotReceived;BadSegment;BadSegmentTime;BadCRC;BadFormat;UndefinedErrors;HexSN;CSN;PermanentCSN;VerboseBuffer;VerboseBufferSettings;AccessLevel;WAccess;Flags;":"")}}`);
        if(res.ok) { return {ok:true, authorized:true, data:res.data.IOUNIT, status:res.status}; }else{ return res; }
    }

    async getIOUnit(i, verbose=false) {
        var res = await this.listIOUnits(i,verbose);
        return res;
    }

    async getIOUnitChannels(i,verbose=false) {
        var res = await this.listIOChannels(i,this.ALL,verbose);
        return res;
    }
    
    async removeIOUnit(i) {
        var res = await this.get(`{DELETE IOUNIT(${i});}`,this.mode.set);
        return res;
    }

    async renameIOUnit(i,name) {
        var res = await this.edit('IOUNIT',i,'Name',name);
        return res;
    }

    async startIOUnit(i) {
        var res = await this.get(`{CMD IOUNIT(${i}){Cmd="RUN";}}`,this.mode.set);
        return res;
    }

    async stopIOUnit(i) {
        var res = await this.get(`{CMD IOUNIT(${i}){Cmd="STOP";}}`,this.mode.set);
        return res;
    }

    // IOChannel functions

    async createIOChannel(parentIOUnit, name, direction=this.def.IOCHANNEL.OUTPUT, connectionIO=1, extra='') {
        var res = await this.get(`{NEW IOCHANNEL{Name="${name}";Direction=${direction};ParentIOUnit=${parentIOUnit};ConnectionIO=${connectionIO};${extra}}}`,this.mode.set);
        return res;
    }
    
    async formatIOChannel(i,format=this.def.FORMAT.NORMAL,decimals=0,base=0,digits=0,list='',scientific=0) {
        var res = await this.get(`{EDIT SHOWRESDEF(IOCHANNEL(${i})){Type=${format};Decimals=${decimals};Base=${base};Digits=${digits};${(list===""?"":'List="'+list+'";')}${(format===this.def.FORMAT.FLOAT?"Scientific="+scientific:"")}}}`,this.mode.set);
        return res;
    }

    async getIOChannel(i,verbose=false) {
        var res = await this.get(`IOCHANNEL{i=${i}0;Identifier;Name;Value;ShowResValue;Unit;ParentIOUnit;Direction;ConnectionIO;Scale;Offset;DefaultValue;DefaultOnError;RawValue;State;${(verbose===true?"":"NAME;IOUnitChannelName;UseFlags;MOAllowed;MOActive;MODuration;MOValue;MOTimer;SensorTypeDefId;ScriptFormula;ScriptFormulaStatus;AccessLevel;WAccess;MOShowResValue;DefShowResValue;")}}`);
        if(res.ok) { return {ok:true, authorized:true, data:res.data.IOCHANNEL, status:res.status}; }else{ return res; }
    }

    async listIOChannels(parentIOUnit=this.ALL,direction=this.ALL,verbose=false) {
        var res = await this.get(`IOCHANNEL{i>0;Identifier;Name;Value;ShowResValue;Unit;ParentIOUnit${(parentIOUnit!==this.ALL?"="+parentIOUnit:"")};Direction${(direction===this.ALL?"":"="+direction)};ConnectionIO;Scale;Offset;DefaultValue;DefaultOnError;RawValue;State;${(verbose===true?"":"NAME;IOUnitChannelName;UseFlags;MOAllowed;MOActive;MODuration;MOValue;MOTimer;SensorTypeDefId;ScriptFormula;ScriptFormulaStatus;AccessLevel;WAccess;MOShowResValue;DefShowResValue;")}}`);
        if(res.ok) { return {ok:true, authorized:true, data:res.data.IOCHANNEL, status:res.status}; }else{ return res; }
    }
    
    async removeIOChannel(i) {
        var res = await this.get(`{DELETE IOCHANNEL(${i});}`,this.mode.set);
        return res;
    }

    async renameIOChannel(i,name) {
        var res = await this.edit('IOCHANNEL',i,'Name',name);
        return res;
    }

    async setIOChannel(i,value) {
        var res = await this.edit('IOCHANNEL',i,'Value',value);
        return res;
    }

    // System functions

    async systemInfo(verbose=false) {
        var res = await this.get(`SYSTEM{i>0;ModuleName;ModuleAddress;EpochTime;LocalTime;UtcTime;AlarmCntA;AlarmCntB;AlarmCntAll;EventCnt;NoteChange;ActiveMO;ErrorModeStatus;SWRelease;HWVersion;SerialNumber;Eth0Dhcp;Eth0Mac;Eth0Ip;Eth0Netmask;Eth0Gateway;Eth0StaticIp;Eth0StaticNetmask;Eth0StaticGateway;Dns1;Dns2;Dns3;StatUptime;${(verbose==true?"UseNTP;NTPServer;ProcessId;AlarmEventCnt;AlarmCntAck;EventCntAck;StatLastAppMRunTime;StatAvgAppMRunTime;StatMinAppMRunTime;StatMaxAppMRunTime;StatTLeftAppMRunTime;StatUserCpu;StatNiceCpu;StatSystemCpu;StatIdleCpu;StatIOWaitCpu;StatIrqCpu;StatSoftIrqCpu;StatStealCpu;StatGuestCpu;StatGuestNiceCpu;StatOneMinLoad;StatFiveMinLoad;StatFifteenMinLoad;StatSQLiteMem;StatMemActive;StatMemMainBuffers;StatMemCached;StatMemInactive;StatMemMainFree;StatMemMainTotal;StatProgramUptime;StatRootFsFree;StatRootFsTot;StatUltraFsFree;StatUltraFsTot;StatTmpFsFree;StatTmpFsTot;SWVersionAppUltra;SWVersionAppService;SWVersionKernel;SWVersionKernelUname;SWVersionRescue;SWVersionRootfs;PerBackupPeriod;PerBackupOffset;BackupStatus;RestoreStatus;BackupResult;RestoreResult;FactoryRestored;BackupErrMsg;RestoreErrMsg;TemplateAppIndex;ScriptKeywords;ScriptReserved;StartPageType;StartPageIndex;ScriptFormulaCheck;ShowResDefClipBoard;UploadCounter;SetSessionIP;MailProcStatus;IsRemovingAllMails;QueuedAlarmMails;QueuedLogMails;WAccess;":"")}}`);
        if(res.ok) { return {ok:true, authorized:true, data:res.data.SYSTEM, status:res.status}; }else{ return res; }
    }
    
    async systemReboot() {
        var res = await this.get(`{CMD SYSTEM(1){Cmd="Reboot";}}`,this.mode.set);
        return res;
    }
}


module.exports = {Api};