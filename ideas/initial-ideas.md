# Initial ideas

I want an application that supports the following:

# Overall

- The app should be in norwegian
- It will be built with React Router 7s framwework mode (https://reactrouter.com/start/framework/installation)
- It will use Postgresql for database and Prisma as database ORM (https://www.prisma.io/)

### Todays flow when meal planning

Todays flow is as follows: We have a Notion database with recipies. I then select one per day of the week (we typically only plan dinners), but I think this app should be flexible enough to support both breakfast, lunch, snack, dinner and supper. When the recipies has been locked in and confirmed by my wife, I create the shopping list. I then transfer the shopping list item by item manually from Notion to the iOs application Bring (shopping list app). I then go through our frigde, freezer and cupboards to see if we have any of the items on the shopping list before heading to the store. At the store, I manually sort the categories if they don't fit the stores layout before starting to shop.

In an ideal world, I would select a couple of dishes for the week (perhaps this new version could automatically select 7 dishes for a week and then we can manually override if necessary) and then I would ask my wife to confirm the dishes. In the background, a shopping list is being maintained based on the selected dishes. When at the store, I simply select the store I am shopping in, and the sorting fixes itself automatically.

I would also like to be able to add other items which isnt necessarily food items to the shopping list, and I would also like to be able to postpone the buying for items for a later day (e.g we shop at monday, but we need some fresh produce for saturday, then I would like to be reminded that there are items in the shopping list remaining for this weeks dishes). It should also be possible to add a store to the item, perhaps it is only possible to be bought in specific stores.

The shopping list should be easy to use when in the store, and it should be easy to check of bought items.

The shopping list should support multiple weeks and reuse of weeks. Some weeks we will start planning on thursday for the coming week, meaning there will be thursdag, friday, saturday and sunday in the active week before next week starts.

I would also be able to synchronize the meal plan to one entry per week day to my iCal calender. Perhaps a sync button per day so can I actively select which days I want in my calender.

I should be able to set start and end date for the created week

## Users

- Logged in users
- Users can be part of a Family
- Users can register themselve for the application
- A user can create a family (he or she then becomes an admin for the family)
- A user can be added to a family by providing a unique code for that family

## Administrator

- An administrator is a user with extra priviliege
- An administrator can add global recipies
- An administrator can add other users (think adding them without the user registering themselves)

## Family

- A family can create one or more meal plans for a week
- A family can select from their own meals, or from a global selection of meals
- A family can be in "meal planning mode" or in "shopping mode" at the store
- Every member of the family can collaborate on the meal plan and on the shopping list

## Shopping list

- The shopping list should be easy to use in the store
- The shopping list should be automatically updated based on the meal plan for the selected week
- A shopping list has a number of items in it
- A shopping list can be sorted by their ingredient categories, and it can be a different sorting for different stores, as different stores may have different layouts. The family member need to be able to specify sort order of categories per saved store

## Store

## Shopping item

- A shopping item can be from a fixed set of ingredients, or manually added by the family member (user)
- A shopping item should be grouped into their section of the store (e.g fresh produce, meat and fish, frozen etc...)

## Recipies

- A recipe can be stored in the system
- A recipe can be connected to a meal in the meal plan
