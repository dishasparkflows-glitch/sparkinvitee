import Campaign from '../models/Campaign.js';

export const handleMessageCreate = async (msgTo, messageId, getContactIdFunc) => {
  try {
    if (msgTo) {
      let actualNumber = msgTo.split('@')[0].split(':')[0];
      try {
        if (msgTo.includes('@lid') && getContactIdFunc) {
           const msgContact = await getContactIdFunc(msgTo);
           if (msgContact && msgContact.id && msgContact.id.user) {
              actualNumber = msgContact.id.user;
           } else if (msgContact && msgContact.number) {
              actualNumber = msgContact.number;
           }
        }
      } catch(err) {
        console.error("Error resolving lid in handleMessageCreate", err);
      }
      
      const cleanNumber = actualNumber;
      const possibleNumbers = [cleanNumber, cleanNumber.replace(/^91/, '')];
      
      const campaign = await Campaign.findOne({ 
        'contacts': {
          $elemMatch: {
            number: { $in: possibleNumbers },
            $or: [{ messageId: null }, { messageId: { $exists: false } }]
          }
        }
      }).sort({ createdAt: -1 });
      
      if (campaign) {
        const contact = campaign.contacts.find(c => possibleNumbers.includes(c.number) && (!c.messageId));
        if (contact) {
          await Campaign.updateOne(
            { _id: campaign._id, 'contacts._id': contact._id },
            { $set: { 'contacts.$.messageId': messageId } }
          );
        }
      }
    }
  } catch (err) {
    console.error('Error in handleMessageCreate:', err);
  }
};

export const handleMessageAck = async (messageId, ack, msgTo, getContactIdFunc) => {
  try {
    let updateField = null;
    let incField = null;
    let extraUpdateField = null;
    
    // Ack values (roughly):
    // 1 = SENT
    // 2 = DELIVERED (RECEIVED)
    // 3 = READ
    if (ack === 1) {
      updateField = 'contacts.$.delivery.sent';
    } else if (ack === 2) {
      updateField = 'contacts.$.delivery.delivered';
      incField = 'stats.delivered';
    } else if (ack === 3 || ack === 4) { // Baileys sends 3 for read, wwebjs 3 for read, 4 for played
      updateField = 'contacts.$.delivery.seen';
      incField = 'stats.seen';
      extraUpdateField = 'contacts.$.delivery.delivered';
    }
    
    if (!updateField) return;
    
    let campaign = await Campaign.findOne({ 'contacts.messageId': messageId });
    let contact = campaign ? campaign.contacts.find(c => c.messageId === messageId) : null;
    
    if (!campaign || !contact) {
      if (msgTo) {
        let actualNumber = msgTo.split('@')[0].split(':')[0];
        try {
          if (msgTo.includes('@lid') && getContactIdFunc) {
            const msgContact = await getContactIdFunc(msgTo);
            if (msgContact && msgContact.id && msgContact.id.user) {
                actualNumber = msgContact.id.user;
            } else if (msgContact && msgContact.number) {
                actualNumber = msgContact.number;
            }
          }
        } catch(err) {
          console.error("Error resolving lid to number", err);
        }
        
        const cleanNumber = actualNumber;
        const possibleNumbers = [cleanNumber, cleanNumber.replace(/^91/, '')];
        
        campaign = await Campaign.findOne({ 
          'contacts': {
            $elemMatch: {
              number: { $in: possibleNumbers },
              $or: [{ messageId: null }, { messageId: { $exists: false } }, { messageId: messageId }]
            }
          }
        }).sort({ createdAt: -1 });
        
        if (campaign) {
          contact = campaign.contacts.find(c => possibleNumbers.includes(c.number) && (!c.messageId || c.messageId === messageId));
        }
      }
    }
    
    if (campaign && contact) {
      if (!contact.messageId) {
        await Campaign.updateOne(
          { _id: campaign._id, 'contacts._id': contact._id },
          { $set: { 'contacts.$.messageId': messageId } }
        );
      }

      const updateDoc = {
        $set: { [updateField]: new Date() }
      };
      
      if (extraUpdateField && !contact.delivery?.delivered) {
          updateDoc.$set[extraUpdateField] = new Date();
          if (incField) {
              updateDoc.$inc = { 
                  [incField]: 1,
                  'stats.delivered': 1
              };
          }
      } else if (incField) {
          if ((ack === 2 && !contact.delivery?.delivered) || ((ack === 3 || ack === 4) && !contact.delivery?.seen)) {
              updateDoc.$inc = { [incField]: 1 };
          }
      }

      if ((ack === 1 && !contact.delivery?.sent) || 
          (ack === 2 && !contact.delivery?.delivered) || 
          ((ack === 3 || ack === 4) && !contact.delivery?.seen)) {
          try {
              await Campaign.updateOne({ _id: campaign._id, 'contacts._id': contact._id }, updateDoc);
          } catch(e) {
          }
      }
    }
  } catch (err) {
    console.error('Error handling handleMessageAck:', err);
  }
};
