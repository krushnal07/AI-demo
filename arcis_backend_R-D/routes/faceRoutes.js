const express = require('express');
const multer = require('multer');
const { registerFace, listFaces, deleteFace } = require('../controllers/faceController');
const { isAuthenticatedUser } = require('../middleware/authMiddleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    },
});

const router = express.Router();

router.post('/register', isAuthenticatedUser, upload.single('image'), registerFace);
router.get('/list', isAuthenticatedUser, listFaces);
router.delete('/:person_name', isAuthenticatedUser, deleteFace);

module.exports = router;
