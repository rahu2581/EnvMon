// This is called with the results from from FB.getLoginStatus().
function statusChangeCallback(response) {
  console.log('statusChangeCallback');
  console.log(response);
  // The response object is returned with a status field that lets the
  // app know the current login status of the person.
  // Full docs on the response object can be found in the documentation
  // for FB.getLoginStatus().
  if (response.status === 'connected') {
    // Logged into your app and Facebook.
    testAPI(response);
  } else if (response.status === 'not_authorized') {
    // The person is logged into Facebook, but not your app.
    document.getElementById('status').innerHTML = 'Please log ' +
      'into this app.';
  } else {
    // The person is not logged into Facebook, so we're not sure if
    // they are logged into this app or not.
    document.getElementById('status').innerHTML = 'Please log ' +
      'into Facebook.';
  }
}

// This function is called when someone finishes with the Login
// Button.  See the onlogin handler attached to it in the sample
// code below.
function checkLoginState() {
  FB.getLoginStatus(function(response) {
    statusChangeCallback(response);
  });
}

window.fbAsyncInit = function() {
  FB.init({
    appId: '282822855397584',
    cookie: true, // enable cookies to allow the server to access
    // the session
    xfbml: true, // parse social plugins on this page
    version: 'v2.5' // use graph api version 2.5
  });

  // Now that we've initialized the JavaScript SDK, we call
  // FB.getLoginStatus().  This function gets the state of the
  // person visiting this page and can return one of three states to
  // the callback you provide.  They can be:
  //
  // 1. Logged into your app ('connected')
  // 2. Logged into Facebook, but not your app ('not_authorized')
  // 3. Not logged into Facebook and can't tell if they are logged into
  //    your app or not.
  //
  // These three cases are handled in the callback function.

  FB.getLoginStatus(function(response) {
    statusChangeCallback(response);
  });

};

// Load the SDK asynchronously
(function(d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0];
  if (d.getElementById(id)) return;
  js = d.createElement(s);
  js.id = id;
  js.src = "//connect.facebook.net/en_US/sdk.js";
  fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

// Here we run a very simple test of the Graph API after login is
// successful.  See statusChangeCallback() for when this call is made.
function testAPI(response) {
  console.log('Welcome!  Fetching your information.... ');
  FB.api('/me', function(response) {
    console.log('Successful login for: ' + response.name);
    document.getElementById('status').innerHTML =
      'Thanks for logging in, ' + response.name + '!';
  });
  // Add the Facebook access token to the Cognito credentials login map.
  AWS.config.region = 'eu-west-1';
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'eu-west-1:d8a9e787-e88b-4940-b2ba-c44a0c833965',
    Logins: {
      'graph.facebook.com': response.authResponse.accessToken
    }
  });


  // Obtain AWS credentials
  AWS.config.credentials.get(function() {
    console.log('AWS successfully authenticated.... ');

    var devices = [{
      "name": "rpi1",
      "title": "Bedroom"
    }, {
      "name": "rpi2",
      "title": "Bathroom"
    }, {
      "name": "rpi3",
      "title": "Livingroom"
    }];

    var temperature = [];
    var humidity = [];

    var temperature_layout = {
      title: 'Temperature',
      xaxis: {
        title: 'Time'
      },
      yaxis: {
        title: 'Temperature in C',
      }

    };
    var humidity_layout = {
      title: 'Humidity',
      xaxis: {
        title: 'Time'
      },
      yaxis: {
        title: 'Humidity in %',
      }
    };


    for (var i = 0; i < devices.length; i++) {
      let device = devices[i];
      console.log('Fetching data for: ' + device.name + ' - ' + device.title);
      let cutoff_date = Date.now() - 24 * 60 * 60 * 1000; //24h range
      let db = new AWS.DynamoDB({
        params: {
          TableName: "environment"
        }
      });
      db.query(params = {
        KeyConditionExpression: "device = :device and #ts > :timestamp",
        ExpressionAttributeNames: {
          "#ts": "timestamp"
        },
        ExpressionAttributeValues: {
          ":device": {
            "S": device.name
          },
          ":timestamp": {
            "S": "" + cutoff_date
          }
        }
      }, function(error, data) {
        if (error) throw error;

        let temp = {
          x: [],
          y: [],
          type: 'scatter',
          opacity: 0.75,
          name: device.title,
          mode: 'line',
          line: {
            shape: 'spline'
          }
        };

        let humi = {
          x: [],
          y: [],
          type: 'scatter',
          opacity: 0.75,
          name: device.title + ' %',
          mode: 'line',
          line: {
            shape: 'spline'
          }
        };

        console.log('Got ' + data.Items.length + ' items');

        for (let i = 0; i < data.Items.length; i++) {
          let item = data.Items[i];
          let date = new Date(item.timestamp.S * 1).toISOString();
          date = date.replace("T", " ");
          date = date.replace("Z", "");

          temp.x.push(date);
          temp.y.push(item.data.M.temperature.S);
          humi.x.push(date);
          humi.y.push(item.data.M.humidity.S);

        };
        console.log('Converted items');
        //console.log('Data temp' + JSON.stringify(temp,null,2));
        //console.log('Data humi' + JSON.stringify(humi,null,2));

        temperature.push(temp);
        humidity.push(humi);
        //console.log('Data temp' + JSON.stringify(temperature,null,2));
        //console.log('Data humi' + JSON.stringify(humidity,null,2));
        Plotly.newPlot('temperature', temperature, temperature_layout);
        Plotly.newPlot('humidity', humidity, humidity_layout);
      });
    }
  });
}


/* TODO:
 * add npm setup & deployment
 * add timerange select: last 1h, last 24h, last 7d, last 1M, last 3M, last 1Y
 * add toggle for rooms
 * add live view via IoT websocket
 * typescript
 * client timezone
 */
