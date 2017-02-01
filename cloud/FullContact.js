var request = require('request');

var FullContact = {};

/**
 * Calls contacts.scroll repeatedly, starting at cursor, to fetch as
 * many contacts as there are available.
 *
 * @param accessToken FullContact v3 access token.
 * @param cursor Optional cursor at which to start fetching contacts, or null to start with the oldest modified contacts.
 * @return Promise that resolves into an array of FullContact Contact objects. See https://api.fullcontact.com/v3/docs/data-types/contact
 */
FullContact.asyncContactsAfter = function(accessToken, cursor) {
  return FullContact.asyncContactsScroll(accessToken, cursor).then(function(results) {
    if (results['cursor'] != null) {
      return FullContact.asyncContactsScroll(accessToken, results['cursor']).then(function(recursiveResponse) {
        return results.contacts.concat(recursiveResponse.contacts);
      });
    } else {
      console.log("contactsAfter found a total of " + results.contacts.length + " contacts");
      return results.contacts;
    }
  });
};

/**
 * Call FullContact v3 contacts.scroll method once, with the provided
 * access token and cursor. Fetches at most 100 contacts at a time, or
 * whatever the API defaults to.
 *
 * @param accessToken FullContact v3 access token.
 * @param cursor Optional cursor at which to start fetching contacts, or null to start with the oldest modified contacts.
 * @return Promise that resolves into an object containing FullContact contacts. See https://api.fullcontact.com/v3/docs/methods/contacts.scroll
 */
FullContact.asyncContactsScroll = function(accessToken, cursor) {
  var promise = new Parse.Promise();

  if (!accessToken) {
    var e = "No FullContact access token provided";
    console.log(e);
    promise.reject(e);
    return promise;
  }

  var options = {
    method: 'POST',
    url: 'https://api.fullcontact.com/v3/contacts.scroll',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    }
  };
  if (cursor) {
    options['body'] = JSON.stringify({
      'scrollCursor': cursor
    });
  }

  request(options, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var result = JSON.parse(body);
      console.log("contacts.scroll found " + result.contacts.length + " contacts");
      promise.resolve(result);
    } else if (error) {
      console.log("Error contacting FullContact API: " + error);
      promise.reject(error);
    } else {
      var e = "Error contacting FullContact API, statusCode(" + response.statusCode + "): " + body;
      console.log(e);
      promise.reject(e);
    }
  });
  return promise;
};

FullContact.Contact = function(contactData) {
  this.data = contactData;
};

FullContact.Contact.prototype.fullName = function() {
  let name = this.data.contactData.name;
  if (name) {
    return name.givenName + " " + name.familyName;
  } else {
    return undefined;
  }
};

FullContact.Contact.prototype.emails = function() {
  let types = this.data.contactData.emails;
  if (!types) {
    return undefined;
  }
  return types.map(function(o) {
    return o.value;
  });
};

FullContact.Contact.prototype.photoURL = function() {
  let photos = this.data.contactData.photos;
  if (photos && photos.length > 0 && 'value' in photos[0]) {
    return photos[0].value;
  }
  return undefined;
};

module.exports = FullContact;
