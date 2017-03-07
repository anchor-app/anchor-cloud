var FullContact = require('./FullContact');

var Contact = Parse.Object.extend("Contact");

var Contacts = {};

Contacts.asyncUpdateOrCreateContact = function(user, fullContactData) {
  var promise = new Parse.Promise();
  var fullContact = new FullContact.Contact(fullContactData);

  let emails = fullContact.emails();
  console.log("Processing contact with emails: " + emails);

  var query = new Parse.Query('Contact');
  query.equalTo('emails', emails[0]);
  query.find({ 'sessionToken': user.getSessionToken() }).then(function(results) {
    var anchorContact;
    if (results.length == 1) {
      anchorContact = results[0];
    } else if (results > 0) {
      // TODO: log this.
      console.log("Found more than one result searching for contact with emails: " + emails);
    } else {
      // Need to create a new Contact model.
      anchorContact = new Contact();
      console.log("Creating new Contact with emails: " + emails);

      var acl = new Parse.ACL(user);
      let teamId = user.get('teamId');
      if (teamId) {
        acl.setRoleReadAccess(teamId, true);
        acl.setRoleWriteAccess(teamId, true);
      }
      anchorContact.setACL(acl);
    }
    Contacts.updateContactWithFullContact(anchorContact, fullContact);
    anchorContact.save().then(function() {
      console.log("Saving Contact succeeded: " + emails);
      promise.resolve();
    }, function(e) {
      // TODO: do something here.
      console.log("Saving Contact failed: " + e);
      promise.reject(e);
    });
  }, function(e) {
    console.log("Querying for Contact failed: " + e);
    promise.reject(e);
  });

  return promise;
};

Contacts.updateContactWithFullContact = function(anchorContact, fullContact) {
  let name = fullContact.fullName();
  if (name) {
    anchorContact.set('fullName', name);
  }

  let emails = fullContact.emails();
  if (emails) {
    anchorContact.set('emails', emails);
  }

  let photoURL = fullContact.photoURL();
  if (photoURL) {
    anchorContact.set('photoURL', photoURL);
  }

  anchorContact.set('fullContactJSON', fullContact.data);
};

module.exports = Contacts;
