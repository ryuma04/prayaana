// Package seed loads reference data into the database and creates the demo world.
package seed

import (
	_ "embed"
	"encoding/json"
	"fmt"

	"trizpyy/internal/catalog"
)

//go:embed data/catalog.json
var catalogJSON []byte

// Catalog returns the embedded reference data (the single source of the catalog).
func Catalog() (catalog.Data, error) {
	var d catalog.Data
	if err := json.Unmarshal(catalogJSON, &d); err != nil {
		return d, fmt.Errorf("decode embedded catalog: %w", err)
	}
	for i := range d.Vendors {
		d.Vendors[i].Available = true // partners take bookings until the operator pauses them
	}
	return d, nil
}
