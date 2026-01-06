export const validGedcomSimple = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME John /Doe/
1 SEX M
1 BIRT
2 DATE 1 JAN 1900
2 PLACE New York
1 DEAT
2 DATE 1 DEC 1990
0 TRLR`;

export const validGedcomWithRelationships = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME John /Doe/
1 SEX M
1 BIRT
2 DATE 1 JAN 1900
2 PLACE New York
0 @I2@ INDI
1 NAME Jane /Doe/
1 SEX F
1 BIRT
2 DATE 15 MAR 1905
2 PLACE Boston
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 @I3@ INDI
1 NAME Bob /Doe/
1 SEX M
1 BIRT
2 DATE 10 JUN 1930
0 TRLR`;

export const validGedcomWithReligionAndOccupation = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME John /Doe/
1 SEX M
1 RELIGION
2 PLACE Protestant
1 OCCUPATION
2 PLACE Engineer
0 TRLR`;

export const validGedcomWithEvents = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME John /Doe/
1 SEX M
1 EVEN
2 TYPE Marriage
2 DATE 1 JAN 1920
2 PLACE New York
0 TRLR`;

export const invalidGedcomEmpty = '';

export const invalidGedcomMalformed = `0 HEAD
1 INVALID TAG
0 TRLR`;

export const validGedcomWithStructuredName = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME
2 GIVN John
2 SURN Doe
1 SEX M
0 TRLR`;

