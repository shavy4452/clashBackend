const config = {
    isProduction: false,
    env: "development",
    port: 2228,
    domain: "http://localhost:2228",
    db: {
        host: "localhost",
        username: "root",
        password: "Sarvesh@4452",
        database: "clashtracker"
    },
    mongoDB: {
        url: "mongodb+srv://shavy:sarvesh4452@cluster0.jh91n.mongodb.net/?retryWrites=true&w=majority",
        clanDB: "linking",
        playerDB: "player_linking",
        collection: "whatshapp"
    },
    clashApi: {
        username: "admin@clashpanda.xyz",
        password: "ClashPanda@0710",
        keyname: "dev backend"
    },
    jwt_secret: "kbvgedcyxuhjvgushdxhsfxdyguydsgxbuywgsyugbwquiu09w7878yhhyugduhudhytgysgysgftyfg",   
    webhook: "https://discord.com/api/webhooks/1193276775506116609/yO4ed16TkJPVdTvpFxj7zJfvmGFpsOPPo4n9QoJ8g_qtXsf7vf4m_vavWcy9cjWYBSgd"
}

module.exports = config;