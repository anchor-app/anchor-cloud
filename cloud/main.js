var FullContact = require('./FullContact');
var Contacts = require('./Contacts');
var SearchContactIndex = require('./SearchContactIndex');

/**
 Search for contacts by email and name.
 Takes on argument in the query string, q, which is the string to search for. We
 split that string by spaces and @ and find all contacts with text that begins
 with those values.

 Returns at most 100 tuples of { contactId, fullName }
 */
Parse.Cloud.define('searchContacts', function (req, res) {
  let q = req.params.q;
  let user = req.user;

  var pieces = q.trim().replace('@', ' ').replace('.', ' ').replace('-', ' ').split(' ');
  var queries = [];
  for (var p of pieces) {
    if (p.length == 0) {
      continue;
    }
    var queryPiece = new Parse.Query('SearchContactIndex');
    queryPiece.startsWith('text', p);
    queries.push(queryPiece);
  }
  // Don't try any queries with no items.
  if (queries.length == 0) {
    res.success([]);
    return;
  }

  var query = new Parse.Query('SearchContactIndex');
  query._orQuery(queries);

  query.find({ 'sessionToken': user.getSessionToken() }).then(function(indexes) {
    var results = [];
    var contactIdSet = new Set();

    // There can be duplicate contactId, fullName pairs in the results,
    // dedup them.
    for (var i of indexes) {
      if (!contactIdSet.has(i.get('contactId'))) {
        results.push({
          'contactId': i.get('contactId'),
          'fullName': i.get('fullName')
        });
        contactIdSet.add(i.get('contactId'));
      }
    }

    res.success(results);
  }, function(error) {
    res.error(error);
  });
});

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
      promises.push(Contacts.asyncUpdateOrCreateContact(user, fullContact));
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

Parse.Cloud.afterSave("Contact", function(request) {
  var anchorContact = request.object;

  // After saving, update the index we use to search for contacts.
  SearchContactIndex.createIndexesForContact(anchorContact);
});
