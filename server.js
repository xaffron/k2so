'use strict'

const express = require('express')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')
const needle = require('needle')

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})


var HELP_TEXT = `
I will respond to the following messages:
\`help\` - to see this message.
\`hi\` - to demonstrate a conversation that tracks state.
\`thanks\` - to demonstrate a simple response.
\`<type-any-other-text>\` - to demonstrate a random emoticon response, some of the time :wink:.
\`attachment\` - to see a Slack attachment message.
`
let baseUrl = process.env.BASE_URL || `https://beepboophq.com/proxy/${process.env.BEEPBOOP_PROJECT_ID}`
let config = module.exports = {
  // HTTP port
  port: process.env.PORT || 4000,

  // External base URL
  base_url: baseUrl,

  // Slapp config
  debug: !!process.env.DEBUG,
  slapp_colors: true,
  slapp_log: true,
  slack_verify_token: process.env.SLACK_VERIFY_TOKEN,

  // Beep Boop Persist API provider (beepboop, fs, memory)
  persist_provider: process.env.PERSIST_PROVIDER || 'beepboop',

  // Beep Boop Project Id and Token for Chronos API
  beepboop_project_id: process.env.BEEPBOOP_PROJECT_ID,
  beepboop_token: process.env.BEEPBOOP_TOKEN,

  validate: () => {
    let required = ['beepboop_token']

    required.forEach((prop) => {
      if (!config[prop]) {
        throw new Error(`${prop.toUpperCase()} required but missing`)
      }
    })
    return config
  }
}

//BEGIN CHRONOS
module.exports = (config) => {
  return new Chronos(config)
}

class Chronos {
  constructor (config) {
    if (!config.beepboop_token) throw new Error('beepboop_token required')
    if (!config.beepboop_project_id) throw new Error('beepboop_project_id required')
    this.token = config.beepboop_token
    this.project_id = config.beepboop_project_id
    this.base = config.base || 'https://beepboophq.com/api/v1/chronos'
  }

  list (callback) {
    this._get(`${this.base}/tasks`, callback)
  }

  active (callback) {
    this._get(`${this.base}/tasks?inactive=false`, callback)
  }

  inactive (callback) {
    this._get(`${this.base}/tasks?inactive=true`, callback)
  }

  create (data, callback) {
    needle.post(`${this.base}/tasks`, data, this._baseOptions(), (err, resp) => {
      if (err) return callback(err)
      if (resp.statusCode !== 201) {
        return callback(new Error(`unsuccesful status code ${resp.statusCode}`))
      }
      callback(null, resp.body)
    })
  }

  scheduleSyntheticEvent (msg, cron, type, payload, callback) {
    let ts = Date.now() + ''

    this.create({
      schedule: cron,
      url: `https://beepboophq.com/proxy/${this.project_id}/slack/event`,
      method: 'POST',
      headers: {
        'BB-Enrich': `slack_team_id=${msg.meta.team_id}`
      },
      payload: {
        token: msg.body.token,
        team_id: msg.meta.team_id,
        type: 'event_callback',
        event: {
          ts: ts,
          event_ts: ts,
          type: type,
          payload: payload,
          user: msg.meta.user_id,
          channel: msg.meta.channel_id
        }
      }
    }, callback)
  }

  delete (id, callback) {
    console.log(`${this.base}/tasks/${id} - ${this.token}`)
    needle.delete(`${this.base}/tasks/${id}`, null, this._baseOptions(), (err, resp) => {
      if (err) return callback(err)
      if (resp.statusCode !== 200) {
        return callback(new Error(`unsuccesful status code ${resp.statusCode}`))
      }
      callback(null, resp.body)
    })
  }

  _get (url, callback) {
    needle.get(url, this._baseOptions(), (err, resp) => {
      if (err) return callback(err)
      if (resp.statusCode !== 200) {
        return callback(new Error(`unsuccesful status code ${resp.statusCode}`))
      }
      callback(null, resp.body)
    })
  }

  _baseOptions () {
    return {
      headers: {
        Authorization: `Bearer ${this.token}`
      },
      json: true
    }
  }
}

//END CHRONOS

//*********************************************
// Setup different handlers for messages
//*********************************************

// response to the user typing "help"
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  msg.say(HELP_TEXT)
})

// "Conversation" flow that tracks state - kicks off when user says hi, hello or hey
slapp
  .message('^(hi|hello|hey)$', ['direct_mention', 'direct_message'], (msg, text) => {
    msg
      .say(`${text}, how are you?`)
      // sends next event from user to this route, passing along state
      .route('how-are-you', { greeting: text })
  })
  .route('how-are-you', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    // user may not have typed text as their next action, ask again and re-route
    if (!text) {
      return msg
        .say("Whoops, I'm still waiting to hear how you're doing.")
        .say('How are you?')
        .route('how-are-you', state)
    }

    // add their response to state
    state.status = text

    msg
      .say(`Ok then. What's your favorite color?`)
      .route('color', state)
  })
  .route('color', (msg, state) => {
    var text = (msg.body.event && msg.body.event.text) || ''

    // user may not have typed text as their next action, ask again and re-route
    if (!text) {
      return msg
        .say("I'm eagerly awaiting to hear your favorite color.")
        .route('color', state)
    }

    // add their response to state
    state.color = text

    msg
      .say('Thanks for sharing.')
      .say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
    // At this point, since we don't route anywhere, the "conversation" is over
  })

// Can use a regex as well
slapp.message(/^(thanks|thank you)/i, ['mention', 'direct_message'], (msg) => {
  // You can provide a list of responses, and a random one will be chosen
  // You can also include slack emoji in your responses
  msg.say([
    "You're welcome :smile:",
    'You bet',
    ':+1: Of course',
    'Anytime :sun_with_face: :full_moon_with_face:'
  ])
})

// demonstrate returning an attachment...
slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
  msg.say({
    text: 'Check out this amazing attachment! :confetti_ball: ',
    attachments: [{
      text: 'Slapp is a robust open source library that sits on top of the Slack APIs',
      title: 'Slapp Library - Open Source',
      image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
      title_link: 'https://beepboophq.com/',
      color: '#7CD197'
    }]
  })
})

// Catch-all for any other responses not handled above
/*
slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
  // respond only 40% of the time
  if (Math.random() < 0.4) {
    msg.say([':wave:', ':pray:', ':raised_hands:'])
  }
})
*/

slapp.message('.*', 'mention', (msg) => {
  var dice = Math.random();
  var answer = 'Goodbye.';
  if (dice > 0.9) {
    answer='I\'ll be there for you. The captain said I had to.';
  } else if (dice > 0.7) {
    answer='The captain says you\'re a friend. I will not kill you.';
  } else if (dice > 0.6) {
    answer='There were a lot of explosions for two people blending in.';
  } else if (dice > 0.5) {
    answer='Congratulations, you\'re being rescued.';
  } else if (dice > 0.4) {
    answer='Why do you get a blaster and I don\'t?';
  } else if (dice > 0.3) {
    answer='I find that answer vague and unconvincing.';
  } else if (dice > 0.2) {
    answer='I\'m not very optimistic about our odds.';
  } else if (dice > 0.1) {
    answer='Quiet!  And there\'s a fresh one if you mouth off again.';
  } else {
    answer='Goodbye.';
  };
  msg.say({
      as_user: true,
      text: answer
     });
})

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
