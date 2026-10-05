const savedModel = require("../model/saved.js");

const getUsedLocation = async (req, res) => {
  try {
    const find = await savedModel
      .find({ email: req.user.email })
      .select("-email")
      .limit(5);
    if (!find) {
      return res.status(400).json({ message: "Fetching Used Location Failed" });
    }
    return res
      .status(200)
      .json({ message: "Fetching Successful", data: find.reverse() });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
const deleteLocation = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Id Is Required To Delete" });
  }
  try {
    const find = await savedModel.findByIdAndDelete(id);
    if (!find) {
      return res.status(400).json({ message: "Deleting Used Location Failed" });
    }
    return res.status(200).json({ message: "Deleting Successful" });
  } catch (error) {
    console.log(error.message);

    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

module.exports = { getUsedLocation, deleteLocation };
