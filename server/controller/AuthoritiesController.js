import User from "../models/userModel.js";
import StandPoint from "../models/standPoint.js";
import asyncHandler from "express-async-handler";
import registerRequest from "../mailer/registerRequestMail.js";

/**
 *
 * @desc save 4 stand points selected by the user in the da
 *
 * expected Json
 * {
 *      SelectedPoints: [{
 *              name: "xyz",
 *              location: "abc",
 *              geometry: {
 *                  coordinates: [80.7397, 22.383]
 *                  },
 *              numberOfUser: 30
 *          }, {}, {}]
 * }
 *
 */

export const createStandPoint = asyncHandler(async (req, res) => {
  const { selectedPoints } = req.body;

  // insert 4 stand points
  const createdStandPoints = await StandPoint.insertMany(selectedPoints);
  if (!createdStandPoints) {
    res.status(500);
    throw new Error("Unable to create standpoints");
  }

  res.status(201).send(createdStandPoints);
});

/**
 * @desc Creates a vaccine drive
 * @private
 */

/**
 * expected req.body
 * {
 *     SelectedPoints: [{
 *              "_id": "473873"
 *              name: "xyz",
 *              location: "abc",
 *              geometry: {
 *                  coordinates: [80.7397, 22.383]
 *                  },
 *              numberOfUser: 30
 *          }, {}, {}]
 * }
 *
 *
 * [[89,89], [50, 67], [78, 90], [60,90]]
 *
 * [89,89] => [{},{},{}]
 * [50, 67] => [{},{},{}]
 */

export const createDrive = asyncHandler(async (req, res) => {
  const { driveStandPoints } = req.body;

  const coordArray = [];
  const foundUsers = [];

  // flatten object to get array of coordinates
  driveStandPoints.forEach((drivePoint) => {
    coordArray.push(drivePoint.geometry.coordinates);
  });

  if (coordArray.length === 0) {
    res.status(404);
    throw new Error("No drive points found ");
  }

  // query for user with only 1 data point
  const usersWithinRange = await User.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: coordArray[0],
        },
        distanceField: "dist.calculated",
        maxDistance: 3000,
        spherical: true,
      },
    },
  ]);
  foundUsers.push(...usersWithinRange);

  if (foundUsers.length === 0) {
    res.status(404);
    throw new Error("No users within range of drive points found");
  }

  // add stand points to the User model from each user in foundUsers array
  foundUsers.forEach(async (user) => {
    // update stand_point in userModel
    const foundedUser = await User.findOne(user._id);
    driveStandPoints.forEach((standPoint, index) => {
      foundedUser.mapViewStandPoints.push(driveStandPoints[index]._id);
    });
    await foundedUser.save();

    // Send mail For registeration
    registerRequest(foundedUser);
  });

  // do other stuff before sending the res
  res.status(200).send(foundUsers);
});

/*
 @desc: Get registered Users details and show them in table in frontend  Get UserName, mobile number, stand point (id), Serial Number, isVaccinated
 @route:  GET /get-registered-users
 @access  Private
 */
export const getDriveUserData = asyncHandler(async (req, res) => {
  const standPointId = req.params.id;
  const registeredUsers = await User.find({
    isRegistered: true,
    standPointAssigned: standPointId,
  });
  res.status(200).send(registeredUsers);
});
