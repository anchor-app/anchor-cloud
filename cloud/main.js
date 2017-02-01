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

    return Parse.Promise.when(promises);
  }).then(function() {
    res.success("Synced some contacts.");
  }, function(e) {
    res.error(e);
  });
});
