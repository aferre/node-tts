/* jslint node: true */
"use strict";
var http = require('http');
var url = require('url');
var redis = require('redis');
var redisProducer = redis.createClient();

var CACHE = true;

redisProducer.on('connect', function() {
    console.log("CONNECTED: ");
});

redisProducer.on('ready', function() {
    console.log("READY: ");
});

redisProducer.on('end', function() {
    console.log("ENDED: ");
});

function requestData(text, lang, done, error) {

    var ur = url.parse("translate.google.com/translate_tts", true);
    ur.query = {
        'tl': lang,
        'q': text
    };
    var formated = url.parse(url.format(ur), true);

    //console.log(formated.path);

    var options = {
        host: 'translate.google.com',
        path: formated.path,
        headers: {
            'user-agent': 'Mozilla/5.0'
        }
    };

    var req = http.request(options, function(res) {
        var data = [];
        var chunks = 0;

        res.on('data', function(chunk) {
            chunks++;
            data.push(chunk);
        }).on('end', function() {

            console.log('Retrieved ' + chunks + ' chunks.');

            var buffer = Buffer.concat(data);

            if (buffer.length === 0) {
                console.log("Retrieved empty data!");
                error();
            }
            else {

                if (CACHE) {
                    var key = "audio";

                    var rcli = redis.createClient();
                    var rclimulti = redis.createClient();

                    rcli.exists(key + ':uuid', function(error, exists) {
                        if (error) {
                            console.log('ERROR: ' + error);
                        }
                        else if (!exists) {
                            rcli.set(key + ':uuid', 0);
                        }

                        console.log("Persisting audio data for " + text);

                        rclimulti.incr(key + ':mp3Number', function(err, uuid) {
                            if (err) {
                                console.log(err);
                                error(err);
                            }
                            else {
                                console.log("Now have " + uuid + " mp3 files.");
                            }
                        });
                        rclimulti.incr(key + ':uuid', function(err, uuid) {

                            if (err) {
                                console.log(err);
                                error(err);
                            }
                            else {
                                console.log("Using " + uuid + " as uuid for " + text);

                                var multi = rcli.multi();

                                var bufferBinary = new Buffer(buffer, 'binary');
                                multi.set(key + ":data:tts:" + uuid, bufferBinary, redis.print);

                                multi.hset(key + ":list", uuid, JSON.stringify({
                                    'lang': lang,
                                    'text': text,
                                    'url': formated
                                }), redis.print);

                                multi.hset(key + ":textList", text, uuid, redis.print);
                                multi.exec(function(err, replies) {
                                    console.log(replies);
                                    multi.quit();
                                    done(buffer, uuid);
                                });

                            }
                        });
                        rclimulti.exec(function(err, replies) {
                            console.log(replies); // 101, 2 
                            rclimulti.quit();
                        });
                    });


                }
                /*
                 * If no cache
                 */
                else {
                    done(buffer);
                }
            }
        });
    });

    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        error(e);
    });

    req.end();
}

var retrieve = function(text, lang, retrievedTTScallback, onError) {

    console.log(text);

    if (CACHE) {

        redisProducer.hexists("audio:textList", text, function(err, reply) {
            if (err) {
                console.log("ERROR is " + err);
            }
            else if (reply) {
                console.log("Does exists ( " + text + " )");
                redisProducer.hget("audio:textList", text, function(err, reply) {
                    var uuid = reply;
                    if (err) {
                        console.log("ERROR is " + err);
                        onError(err);
                    }
                    else if (reply) {
                        console.log("Res is " + reply);

                        var redisProducer2 = redis.createClient(null, null, {
                            return_buffers: true
                        });

                        try {
                            redisProducer2.get("audio:data:tts:"+ reply, function(err, res) {
                                if (err) {
                                    console.log("ERROR: ");
                                    console.log(err);
                                    if (onError) {
                                        onError(err);
                                    }
                                }
                                else {
                                    console.log("Retrieved data to play using redis, uuid is " + uuid);

                                    var buffer = new Buffer(res, "binary");

                                    console.log(buffer);

                                    retrievedTTScallback(text, lang, buffer, reply);
                                }
                            });
                        }
                        catch (err) {
                            console.log(err);
                            if (onError) {
                                onError(err);
                            }
                        }

                    }
                });
            }
            else {
                requestData(text, lang, function(data, uuid) {
                    retrievedTTScallback(text, lang, data, uuid);
                },
                onError);
            }
        });
    }
    else {

        requestData(text, lang, function(data, uuid) {
            retrievedTTScallback(text, lang, data, uuid);
        },
        onError);

    }

};

exports.retrieve = retrieve;
