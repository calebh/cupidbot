const { Client, Intents } = require('discord.js');
require('dotenv').config(); //initialize dotenv

var levelup = require('levelup');
var leveldown = require('leveldown');
var encode = require('encoding-down');

var db = levelup(encode(leveldown('likes'), { valueEncoding: 'json' }));

const client = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.DIRECT_MESSAGES],
	partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});


client.on('messageCreate', async (message) => {
  if(message.author.bot) return;
  if(message.channel.type === "DM")
  {
    let author_key = message.author.id;
    db.get(author_key, (err, author_likes) => {
      if (err) {
        if (err.notFound) {
          message.author.send("CupidBot could not find you in the system, so there is nothing to do.");
          return;
        } else {
          // I/O or other error
          return;
        }
      }
      if (message.content === "undo") {
        if (author_likes.length > 0) {
          author_likes.pop();
          db.set(author_key, author_likes);
          message.author.send("Your last like has been removed.");
        }
      } else if (message.content === "clear") {
        db.del(author_key);
        message.author.send("CupidBot has removed you from the system.");
      } else {
        message.author.send("Unknown command. The only messages I understand are 'undo' and 'clear'");
      }
    });
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
	// When a reaction is received, check if the structure is partial
	if (reaction.partial) {
		// If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
		try {
			await reaction.fetch();
		} catch (error) {
			console.error('Something went wrong when fetching the message:', error);
			// Return as `reaction.message.author` may be undefined/null
			return;
		}
	}

  if (reaction.message.channel.name === "introductions") {
    let liker = user;
    let receiver = reaction.message.author;
    if (receiver !== null && receiver !== undefined && liker.id !== receiver.id) {
      let liker_key = liker.id;
      let receiver_key = receiver.id;

      // Get their old likes
      db.get(liker_key, (err, prev_likes) => {
        if (err) {
          if (err.notFound) {
            // This is a new user, so initialize their like list
            prev_likes = [];
          } else {
            // I/O or other error
            return;
          }
        }

        if (prev_likes.includes(receiver_key))
        {
          // The user has indicated that they would like to unlike this person
          // Remove them from the likes list, update the database and message the user
          // notifying them of the change
          db.put(liker_key, prev_likes.filter((value, index, arr) => value !== receiver_key));
          liker.send("You have unliked " + receiver.toString() + " from your set of likes. To clear all your likes and remove yourself from the CupidBot system, send me a direct message with 'clear' (no quotes)");
          return;
        }
        else
        {
          // This like is new
          // Add the new like to the end and update the database
          prev_likes.push(receiver.id);
          db.put(liker_key, prev_likes);
        }

        // Fetch the likes of the receiver
        db.get(receiver_key, (err_recv, receiver_likes) => {
          if (err_recv) {
            if (err_recv.notFound) {
              receiver_likes = [];
            } else {
              // I/O or other error
              return;
            }
          }
          
          let isMatch = false;

          // Is the liker in the receiver's list? If so we have a match!
          receiver_likes.forEach(receiver_like => {
            if (receiver_like === liker.id) {
              isMatch = true;
            }
          });

          if (isMatch) {
            liker.send("You just liked " + receiver.toString() + " and the feeling is mutual! Congratulations on the match! They have also been notified in a direct message. Due to the current limitations of the Discord API, this bot cannot directly open a message between you two. Please open a direct message on your own :-)");
            receiver.send(liker.toString() + " just liked you, and based on your past likes the feeling is mutual! Congratulations on the match! They have also been notified in a direct message. Due to the current limitations of the Discord API, this bot cannot directly open a message between you two. Please open a direct message on your own :-)");
          } else {
            liker.send("This is a confirmation that your like of " + receiver.toString() + " has been received. If and when they return the like, you will receive another notification via direct message from this bot.");
          }

          liker.send("To remove the like you just sent, send me a direct message with the text 'undo' (no quotes) or react to that person's message again. To clear all your likes and remove yourself from the CupidBot system, send me a direct message with 'clear' (no quotes)");
        });
      });
    }

    // Clear this reaction, thereby hiding the "like"
    reaction.remove();
  }
});

client.login(process.env.CLIENT_TOKEN); //login bot using token