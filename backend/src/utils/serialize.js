export function toId(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  if (obj.__v !== undefined) delete obj.__v;
  if (obj.password) delete obj.password;
  return obj;
}

export function toIds(docs) {
  return docs.map(toId);
}
