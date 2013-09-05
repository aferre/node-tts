"use strict";

var tts = require('./index.js');
var fs = require('fs');

function retrievedTTS(text, lang, data) {
    var rand = Math.floor(Math.random() * (10000000));

        fs.writeFile("/tmp/mp3files/" + rand + ".mp3", data, function(err) {
            if (err) {
                console.log(err);
            }
            else {
                console.log("The file was saved!");
            }
        });
    
}

tts.retrieve('Sample is working!', 'en', retrievedTTS);

