/**
  To make search efficient, we keep SearchContactIndex objects, which are mappings
  from strings to Contact IDs.
*/
class SearchContactIndex extends Parse.Object {
  constructor(text, contactId, fullName) {
    super('SearchContactIndex');

    this.set('text', text);
    this.set('contactId', contactId);
    this.set('fullName', fullName);
  }

  static createIndexesForContact(anchorContact) {
    // Only make indexes for Contacts with names.
    var name = anchorContact.get('fullName');
    if (name.length > 0) {
      var staging = [name];

      var emails = anchorContact.get('emails');
      if (emails) {
        for (var email of emails) {
          staging.push(email);
        }
      }

      var pieces = [];
      for (var s of staging) {
        let fixed = s.replace('-', ' ').replace('@', ' ').replace('.', ' ');
        pieces = pieces.concat(fixed.split(' '));
      }

      for (var p of pieces) {
        let fixed = p.toLowerCase();
        var index = new SearchContactIndex(fixed, anchorContact.id, name);
        index.setACL(anchorContact.getACL());
        index.save(null, {
          success: function() {
            console.log("Saved contact index '" + fixed + "' -> " + anchorContact.id);
          },
          error: function(e) {
            console.error("Error saving contact index '" + fixed + "' -> " + anchorContact.id + ": " + e);
          }
        });
      }
    }
  }
}

module.exports = SearchContactIndex;
