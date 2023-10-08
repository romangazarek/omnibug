/**
 * Braze
 * https://www.braze.com/
 * https://www.braze.com/docs/developer_guide/home

 *
 * @class
 * @extends BaseProvider
 */

class BrazeProvider extends BaseProvider {
    constructor() {
        super();
        this._key       = "BRAZE";
        this._pattern   = /\.braze\.com\/api\/v3\/data/;
        this._name      = "Braze";
        this._type      = "customer";
    }

    /**
     * Retrieve the column mappings for default columns (account, event type)
     *
     * @return {{}}
     */
    get columnMapping()
    {
        return {
            "account":      "api_key",
            "requestType":  "requestTypeParsed"
        };
    }

    /**
     * Retrieve the group names & order
     *
     * @returns {*[]}
     */
    get groups() {
        return [
            {
                key: "general",
                name: "General"
            }
        ];
    }

    /**
     * Parse custom properties for a given URL
     *
     * @param    {string}   url
     * @param    {object}   params
     *
     * @returns {void|Array}
     */
    /*
    handleCustom(url, params)
    {
        let results = [];

        // Account info
        const accountInfo =  url.pathname.match(/\/scripts\/(\d+\/\d+)\.js/);
        if(accountInfo !== null) {
            results.push({
                "key":   "_accountID",
                "field": "Account ID",
                "value": `${accountInfo[1].replace("/", "")}`,
                "group": "general"
            });
        }

        results.push({
            "key":   "requestTypeParsed",
            "field": "Request Type",
            "value": "Library Load",
            "group": "general"
        });


        return results;
    } // handle custom
    */
} // class
