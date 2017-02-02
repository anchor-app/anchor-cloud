var FullContact = require('./FullContact');
var Contacts = require('./Contacts');

/**
 * Sync the FullContact contacts with our Contact objects, for the current user.
 */
Parse.Cloud.define('sync', function (req, res) {
  let user = req.user;

  if (!user) {
    res.error("Cannot complete sync. No current user.");
    return;
  }
  if (!user.get('fullContactAccessToken')) {
    res.error("Cannot complete sync. No FullContact access token.");
    return;
  }

  FullContact.asyncContactsAfter(user.get('fullContactAccessToken'), user.get('fullContactLatestCursor')).then(function(fullContacts) {
    var promises = [];
    for (let fullContact of fullContacts) {
      // Create/update Anchor's model with the FullContact data.
      promises.push(Contacts.asyncUpdateOrCreateContact(fullContact));
    };

    return Parse.Promise.when(promises).then(function() {
      // We successfully synced some contacts. Grab the final etag and use that
      // as future cursors.
      if (fullContacts.length > 0) {
        let etag = fullContacts[fullContacts.length - 1].etag;
        if (etag) {
          user.set('fullContactLatestCursor', etag);
          user.save(null, { sessionToken: user.get("sessionToken") });
          console.log("Setting etag(" + etag + ") for user(" + user.get('username') + ").");
        } else {
          console.log("Couldn't find final etag.");
        }
      }

      var message;
      if (fullContacts.length == 0) {
        message = "No more contacts to sync.";
      } else {
        message = "Synced " + fullContacts.length + " contact" + (fullContacts.length == 1 ? "." : "s.");
      }
      return message;
    });
  }).then(function(message) {
    res.success(message);
  }, function(e) {
    res.error(e);
  });
});
