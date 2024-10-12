import WebSocket from 'ws';

const wss = new WebSocket.Server({ port: 8080 });

interface WebSocketGroup {
    master: WebSocket | null;
    slaves: WebSocket[];
    slaveMessageQueue: string[];
    masterMessageQueue: string[];
}

const groups = new Map<string, WebSocketGroup>();
const nonAnsweringGroups = new Map<string, WebSocketGroup>();

wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');

    ws.on('message', (message: string) => {
        console.log('Received message from client');
        const messageObj: Message = JSON.parse(message.toString());
        const key = messageObj.key;
        const messageText = messageObj.message;
        const master = messageObj.master;
        const canAnswer = messageObj.canAnswer;
        if (key === undefined || messageText === undefined || master === undefined || canAnswer === undefined) {
            ws.send(`invalid message format, correct format is
            {
                "key": "key", 
                "message": "message", 
                "master": true/false,
                "canAnswer": true/false
            } `);
            return;
        }
        if (canAnswer) {
            handleAnsweringClients(key, messageText, master, ws);
            return;
        }
        if (!canAnswer) {
            handleNonAnsweringClients(key, messageText, master, ws);
            return
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

function handleNonAnsweringClients(key: string, messageText: string, master: boolean, ws: WebSocket) {
    if (master) {
        handleNonAnsweringMaster(key, messageText, ws);
        return;
    }
    handleNonAnsweringSlave(key, messageText, ws)

}
function handleNonAnsweringMaster(key: string, messageText: string, ws: WebSocket) {
    let group = nonAnsweringGroups.get(key);
    if (!group) {
        group = {
            master: ws,
            slaves: [],
            slaveMessageQueue: [],
            masterMessageQueue: []
        }
        group.masterMessageQueue.push(messageText);
        nonAnsweringGroups.set(key, group);
        return;
    }
    group.masterMessageQueue.push(messageText);
    if (group.slaves.length > 0) {

        const messageQueue = group.masterMessageQueue;
        group.masterMessageQueue = [];
        messageQueue.push(messageText);

        group.slaves.forEach((slave) => {
            messageQueue.forEach((message) => {
                console.log(message.toString());
                slave.send(message);
            })
        });

        return;
    }
    group.slaveMessageQueue.push(messageText);
}
function handleNonAnsweringSlave(key: string, messageText: string, ws: WebSocket) {
    let group = nonAnsweringGroups.get(key);
    if (!group) {
        group = {
            master: null,
            slaves: [],
            slaveMessageQueue: [],
            masterMessageQueue: []
        }
        group.slaves.push(ws);
        nonAnsweringGroups.set(key, group);
        return;
    }
    group.slaves.push(ws);
}

function handleAnsweringClients(key: string, messageText: string, master: boolean, ws: WebSocket) {
    throw new Error('Not implemented');

}

interface Message {
    key: string;
    message: string;
    master: boolean;
    canAnswer: boolean;
}

function myLoopFunction() {
    console.log('Looping...');
    // code to be executed in the loop
    nonAnsweringGroups.forEach((group) => {
        if (group.slaves.length === 0) {
            return;
        }
        group.masterMessageQueue.forEach((message) => {
            group.slaves.forEach((slave) => {
                slave.send(message);
            })
        });
        group.masterMessageQueue = [];
    });
}

setInterval(myLoopFunction, 10000);