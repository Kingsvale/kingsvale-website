import { describe, expect, it } from "vitest";
import { formatPastedAddress } from "./addressCapitalisation";

describe("pasted address capitalisation", () => {
  it.each([
    ["BALCOMBE LODGE, SPRING LANE, SWALLOWFIELD, RG7 1SU", "Balcombe Lodge, Spring Lane, Swallowfield, RG7 1SU"],
    ["balcombe lodge\nspring lane\nswallowfield\nrg71su", "Balcombe Lodge\nSpring Lane\nSwallowfield\nRG7 1SU"],
    ["LAND ADJACENT TO 5, NEWNHAM LANE, OLD BASING, rg247at", "Land Adjacent to 5, Newnham Lane, Old Basing, RG24 7AT"],
    ["5A O'NEILL'S COURT, MCDONALD ROAD, STOKE-ON-TRENT, ST1 1AA", "5A O'Neill's Court, McDonald Road, Stoke-on-Trent, ST1 1AA"],
    ["1ST FLOOR, ST JOHN’S HOUSE, NEWCASTLE UPON TYNE, NE1 1AA", "1st Floor, St John’s House, Newcastle upon Tyne, NE1 1AA"],
    ["PO BOX 12, RAF VALLEY, ISLE OF ANGLESEY, LL65 3NY", "PO Box 12, RAF Valley, Isle of Anglesey, LL65 3NY"],
    ["McDonald House, O’Neill Court, iQ Building, The Old Rectory, RG7 1SU", "McDonald House, O’Neill Court, iQ Building, The Old Rectory, RG7 1SU"],
    ["5 THE AVENUE, THE OLD VILLAGE, RG7 1SU", "5 The Avenue, The Old Village, RG7 1SU"]
  ])("formats %s", (input, expected) => {
    expect(formatPastedAddress(input)).toBe(expected);
    expect(formatPastedAddress(expected)).toBe(expected);
  });
});
