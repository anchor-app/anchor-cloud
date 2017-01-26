function contactsScroll(user, cursor) {
  var options = {
    url: 'https://api.fullcontact.com/v3/contacts.scroll',
    headers: {
      'Authorization': 'Bearer ' + user.fullContactAccessToken
    }
  };
  if (cursor) {
    options['qs'] = {
      'scrollCursor': cursor
    };
  }

  var promise = new Parse.Promise();

  request(options, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var result = JSON.parse(body);

      promise.resolve(result);
    } else {
      promise.reject(error);
    }
  });
  return promise;
}

/**
 */
function contactsAfter(user, cursor)
{
  return contactsScroll(user, cursor).then(function(results) {
    if (results['cursor'] != null) {
      return contactsScroll(user, results['cursor']).then(function(recursiveResponse) {
        return results.contacts.concat(recursiveResponse.contacts);
      });
    } else {
      return results.contacts;
    }
  });
}

function updateContactWithFullContactInfo(anchorContact, fullContact)
{
  anchorContact.set('fullName', fullContact.contactData.name);
  anchorContact.set('emails', fullContact.contactData.emails);
  if (fullContact.contactData.photos.length > 0 && 'value' in fullContact.contactData.photos[0]) {
    anchorContact.set('photoURL', fullContact.contactData.photos[0].value);
  }
  anchorContact.set('fullContactJSON', fullContact.contactData);
}

/**
 * Sync the FullContact contacts with our Contact objects, for the current user.
 */
Parse.Cloud.define('sync', function (request, response) {
  let user = Parse.currentUser;

  if (!user) {
    response.error("Cannot complete sync. No current user.");
    return;
  }

  contactsAfter(user, user.fullContactLatestCursor).then(function(contacts) {
    for (var contact of contacts) {
      // Create/update Anchor's model with the FullContact data.

      var query = new Parse.Query('Contact');
      query.equalTo('emails', contact.contactData.emails);
      query.find({
        success: function(results) {
          var anchorContact;
          if (results.length == 1) {
            anchorContact = results[0];
          } else if (results > 0) {
            // TODO: log this.
            console.log("Found more than one result searching for contact with emails: " + contact.contactData.emails);
          } else {
            // Need to create a new Contact model.
            anchorContact = new Parse.Object('Contact');
          }
          updateContactWithFullContactInfo(anchorContact, contact);
          anchorContact.save(null, {
            error: function(object, error) {
              // TODO: do something here.
              console.log("Saving Contact failed: " + error);
            }
          });
        },
        error: function(e) {
          console.log("Querying for Contact failed: " + e);
        }
      });
    }
  });
});
