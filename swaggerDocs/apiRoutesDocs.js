/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Check API health
 *     responses:
 *       200:
 *         description: API is running
 */

/**
 * @swagger
 * /getClanInfo/{tag}:
 *   get:
 *     tags:
 *       - Clan Endpoints
 *     summary: Get information about a clan
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Clan data retrieved successfully
 */

/**
 * @swagger
 * /getClanMembers/{tag}:
 *   get:
 *     tags:
 *       - Clan Endpoints
 *     summary: Get members of a clan
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Clan members retrieved successfully
 */

/**
 * @swagger
 * /getCapitalRaidSeasons/{tag}:
 *   get:
 *     tags:
 *       - Clan Endpoints
 *     summary: Get capital raid seasons for a clan
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Capital raid seasons data retrieved successfully
 */

/**
 * @swagger
 * /getClanMembersHero/{tag}:
 *   get:
 *     tags:
 *       - Clan Endpoints
 *     summary: Get hero data for clan members
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Hero data retrieved successfully
 */

/**
 * @swagger
 * /getPlayersInfo/{tag}:
 *   get:
 *     tags:
 *       - Player Endpoints
 *     summary: Get player information
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the player
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Player information retrieved successfully
 */

/**
 * @swagger
 * /getCurrentWar/{tag}:
 *   get:
 *     tags:
 *       - War Endpoints
 *     summary: Get the current war details
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Current war details retrieved successfully
 */

/**
 * @swagger
 * /getWarLog/{tag}:
 *   get:
 *     tags:
 *       - War Endpoints
 *     summary: Get the war log for a clan
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: War log retrieved successfully
 */

/**
 * @swagger
 * /getTHLevels/{tag}:
 *   get:
 *     tags:
 *       - Clan Endpoints
 *     summary: Get Town Hall levels for clan members
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Town Hall levels retrieved successfully
 */

/**
 * @swagger
 * /getCWLresults/{tag}:
 *   get:
 *     tags:
 *       - War Endpoints
 *     summary: Get Clan War League results
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: CWL results retrieved successfully
 */

/**
 * @swagger
 * /getWarWeight/{tag}:
 *   get:
 *     tags:
 *       - War Endpoints
 *     summary: Get the war weight of a clan
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: War weight retrieved successfully
 */

/**
 * @swagger
 * /db/getRecords/{phoneNumber}:
 *   get:
 *     tags:
 *       - Database Operations
 *     summary: Get database records by phone number
 *     parameters:
 *       - name: phoneNumber
 *         in: path
 *         required: true
 *         description: Phone number to query records
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Records retrieved successfully
 */

/**
 * @swagger
 * /db/addRecord/{PhoneNumber}/{Type}/{Tag}/{Action}:
 *   get:
 *     tags:
 *       - Database Operations
 *     summary: Add a database record
 *     parameters:
 *       - name: PhoneNumber
 *         in: path
 *         required: true
 *         description: Phone number for the record
 *         schema:
 *           type: string
 *       - name: Type
 *         in: path
 *         required: true
 *         description: Record type
 *         schema:
 *           type: string
 *       - name: Tag
 *         in: path
 *         required: true
 *         description: Record tag
 *         schema:
 *           type: string
 *       - name: Action
 *         in: path
 *         required: true
 *         description: Action performed
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Record added successfully
 */
/**
 * @swagger
 * /clanHistory/{tag}:
 *   get:
 *     tags:
 *       - Clan Endpoints
 *     summary: Get the history of a clan
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Clan history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Clan historical data
 */

/**
 * @swagger
 * /clanMembersHistory/{tag}:
 *   get:
 *     tags:
 *       - Clan Endpoints
 *     summary: Get the history of clan members
 *     parameters:
 *       - name: tag
 *         in: path
 *         required: true
 *         description: The tag of the clan
 *         schema:
 *           type: string
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Clan members history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 membersHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: Clan members' historical data
 */
